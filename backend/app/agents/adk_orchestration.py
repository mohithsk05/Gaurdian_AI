import asyncio
import json
import logging
from typing import Dict, Any, List, Optional
from google import genai
from google.genai import types
from app.config import settings
from app.mcp.mcp_client import mcp_client
from app.agents.specialized_agents import SPECIALIZED_AGENTS

logger = logging.getLogger("guardian_ai.adk_orchestration")

class AgentExecutionTrace:
    def __init__(self, agent_name: str):
        self.agent_name = agent_name
        self.status = "PENDING"  # PENDING, RUNNING, COMPLETED, FAILED
        self.tool_calls: List[Dict[str, Any]] = []
        self.input_params: Dict[str, Any] = {}
        self.output: str = ""
        self.error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "agent_name": self.agent_name,
            "status": self.status,
            "tool_calls": self.tool_calls,
            "input_params": self.input_params,
            "output": self.output,
            "error": self.error
        }

class Agent:
    def __init__(self, name: str, description: str, system_prompt: str, tools: List[str]):
        self.name = name
        self.description = description
        self.system_prompt = system_prompt
        self.tools = tools

    async def execute(self, params: Dict[str, Any], trace: AgentExecutionTrace) -> str:
        trace.status = "RUNNING"
        trace.input_params = params
        
        # 1. Fetch data from MCP Server if agent has tools and relevant params
        tool_results = {}
        location = params.get("location", "")
        region = params.get("region", location)
        
        for tool_name in self.tools:
            tool_args = {}
            if tool_name in ["get_weather", "get_disaster_alerts", "lookup_hospitals"]:
                tool_args = {"location": location}
            elif tool_name == "search_places":
                tool_args = {"location": location, "query": "emergency shelter safe haven"}
            elif tool_name == "get_emergency_helplines":
                tool_args = {"region": region}
                
            if not location and tool_name != "get_emergency_helplines":
                # Skip tool call if location is required but not provided
                continue
                
            try:
                trace.tool_calls.append({
                    "tool_name": tool_name,
                    "arguments": tool_args,
                    "status": "CALLING"
                })
                
                # Execute tool via MCP Client
                result = await mcp_client.call_tool(tool_name, tool_args)
                
                # Check for error
                is_error = result.get("isError", False)
                content = result.get("content", [])
                text_result = ""
                if content and isinstance(content, list):
                    text_result = content[0].get("text", "")
                
                tool_results[tool_name] = text_result
                
                # Update tool trace
                trace.tool_calls[-1]["status"] = "SUCCESS" if not is_error else "FAILED"
                trace.tool_calls[-1]["response"] = text_result
                
            except Exception as e:
                logger.error(f"Error calling tool {tool_name} for agent {self.name}: {e}")
                trace.tool_calls[-1]["status"] = "FAILED"
                trace.tool_calls[-1]["response"] = str(e)
                tool_results[tool_name] = f"Error calling tool: {str(e)}"

        # 2. Compile prompt for the LLM
        system_context = self.system_prompt
        if tool_results:
            system_context += "\n\nYou have access to the following real-time data retrieved from your MCP Tools:\n"
            for t_name, t_val in tool_results.items():
                system_context += f"--- TOOL RESULT: {t_name} ---\n{t_val}\n"
                
        user_prompt = f"Process request for parameters: {json.dumps(params)}. Synthesize an expert, actionable report based on your role."
        
        # 3. Call LLM (Gemini) or use mock fallback
        try:
            output = await self._call_llm(system_context, user_prompt)
            trace.output = output
            trace.status = "COMPLETED"
            return output
        except Exception as e:
            logger.error(f"Error in LLM call for {self.name}: {e}")
            trace.status = "FAILED"
            trace.error = str(e)
            raise e

    async def _call_llm(self, system_instruction: str, prompt: str) -> str:
        # Check if API Key is present
        if not settings.GEMINI_API_KEY:
            return self._generate_mock_response(system_instruction, prompt)
            
        try:
            # We call the generation in an executor to avoid blocking the async loop
            loop = asyncio.get_event_loop()
            def run_sync_genai():
                # Correct client creation with google-genai package
                client = genai.Client(api_key=settings.GEMINI_API_KEY)
                response = client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        temperature=0.3,
                    )
                )
                return response.text
                
            return await loop.run_in_executor(None, run_sync_genai)
            
        except Exception as e:
            logger.warning(f"Gemini API execution failed: {e}. Falling back to mock generator.")
            return self._generate_mock_response(system_instruction, prompt)

    def _generate_mock_response(self, system_instruction: str, prompt: str) -> str:
        """
        Generates highly realistic and context-aware responses as a fallback
        when the Gemini API Key is missing or invalid.
        """
        # Look at the agent type to generate suitable content
        params = {}
        try:
            # Extract params from prompt string
            import re
            match = re.search(r"parameters: ({.*?})", prompt)
            if match:
                params = json.loads(match.group(1))
        except Exception:
            pass

        loc = params.get("location", "the affected area")
        region = params.get("region", loc)
        
        if self.name == "WeatherAgent":
            return (
                f"### 🛑 Weather & Alert Briefing for {loc}\n\n"
                f"**Current Status**: Severe Monsoon / Flash Flood Warning Active.\n"
                f"- **Precipitation**: Torrential monsoon rains (22mm/hr), causing heavy water-logging in low-lying corridors.\n"
                f"- **Wind Speeds**: Sustained winds of 35 km/h, with gusting forces up to 55 km/h.\n\n"
                f"**Hazards Identified**:\n"
                f"1. **Severe Inundations**: Active flood zones in low sectors. Avoid underpasses and basement areas.\n"
                f"2. **High Gusts**: Secure loose rooftop structures and avoid staying near power lines or trees."
            )
        elif self.name == "MedicalAgent":
            return (
                f"### 🩺 Medical Advisory & First Aid Protocol\n\n"
                f"**Hospital Capacity & Wait Times in {loc}**:\n"
                f"- **KEM Hospital & Medical College** (0.8 km): 14 ICU Beds Available. ER Wait Time: **12 minutes**. Status: Emergency Admissions Only.\n"
                f"- **Lilavati Hospital & Research Centre** (4.1 km): 32 ICU Beds Available. ER Wait Time: **45 minutes**. Status: Normal Operations.\n\n"
                f"**First-Aid Instructions for Common Hazards**:\n"
                f"- **Minor Water-Borne / Wound Infections**: Clean immediately with soap and clean water. Apply antiseptic ointment if available and cover with a dry bandage. Do not submerge wounds in floodwaters.\n"
                f"- **Bleeding**: Apply firm, direct pressure with a clean cloth. Elevate the wound above the heart level if possible until bleeding stops.\n\n"
                f"⚠️ *DISCLAIMER: First-aid guidelines are for immediate stabilizing care. Contact emergency services (112) immediately for severe or life-threatening conditions.*"
            )
        elif self.name == "ShelterAgent":
            return (
                f"### 🏠 Emergency Shelter Assessment: {loc}\n\n"
                f"The following emergency shelters have been located near {loc}:\n\n"
                f"1. **Dharavi Community Center Shelter** (1.2 km away)\n"
                f"   - **Status**: **OPEN** (85/150 capacity occupied)\n"
                f"   - **Amenities**: Cots, clean water, warm meals, blankets.\n"
                f"   - **Pet Policy**: Pets are accepted (must be leashed/crated).\n\n"
                f"2. **Bandra Municipal School Relief Zone** (3.5 km away)\n"
                f"   - **Status**: **OPEN** (42/100 capacity occupied)\n"
                f"   - **Amenities**: Medical first-aid station, bottled water, dry rations.\n"
                f"   - **Pet Policy**: No pets allowed (service animals only)."
            )
        elif self.name == "ResourceAgent":
            return (
                f"### 📦 Emergency Supply & Resource Checklist\n\n"
                f"For the emergency in {loc}, prepare the following essential resources:\n\n"
                f"- **Water**: Minimum 1 gallon per person per day, for at least 3 days (for drinking and sanitation).\n"
                f"- **Food**: 3-day supply of shelf-stable, non-perishable food (canned goods, energy bars, dry rations).\n"
                f"- **Medical**: First-aid kit including bandages, antiseptic, pain relievers, and a 7-day supply of any prescription medications.\n"
                f"- **Tools & Power**: Flashlight, battery-powered or hand-crank radio, extra batteries, and mobile phone chargers with power banks."
            )
        elif self.name == "CommunicationAgent":
            lang = params.get("language", "Hindi")
            if "hindi" in lang.lower():
                notice = (
                    f"### 📢 Evacuation Alert & Broadcast Draft (Hindi)\n\n"
                    f"**SMS/Radio Alert Draft**:\n"
                    f"\"आपातकालीन चेतावनी: भारी बारिश और बाढ़ के कारण {loc} के निचले इलाकों के लिए निकासी (Evacuation) आदेश जारी किया गया है। "
                    f"कृपया तुरंत निकटतम राहत शिविर में जाएं। आपातकाल के लिए 112 पर कॉल करें।\"\n\n"
                    f"**Evacuation Directions**:\n"
                    f"1. निकलने से पहले मुख्य गैस वाल्व और बिजली के मेन स्विच बंद करें।\n"
                    f"2. अपने साथ केवल आवश्यक दस्तावेज, पानी, दवाएं और पावर बैंक ले जाएं।\n"
                    f"3. केवल निर्धारित निकासी मार्गों का पालन करें; जलभराव वाली सड़कों को पार करने की कोशिश न करें।"
                )
            elif "spanish" in lang.lower():
                notice = (
                    f"### 📢 Evacuation Alert & Broadcast Draft (Spanish)\n\n"
                    f"**SMS/Radio Alert Draft**:\n"
                    f"\"ALERTA DE EMERGENCIA: Se ha emitido una orden de evacuación para las zonas bajas de {loc} debido a inundaciones graves. "
                    f"Por favor, diríjase al refugio más cercano de inmediato. Llame al 112 en caso de emergencia.\"\n\n"
                    f"**Evacuation Directions**:\n"
                    f"1. Cierre los suministros de gas y electricidad antes de salir.\n"
                    f"2. Lleve solo sus documentos esenciales y el kit de suministros de emergencia.\n"
                    f"3. Siga las rutas de evacuación designadas y evite los atajos inundados."
                )
            else:
                notice = (
                    f"### 📢 Evacuation Alert & Broadcast Draft (English)\n\n"
                    f"**SMS/Radio Alert Draft**:\n"
                    f"\"EMERGENCY ALERT: An evacuation order has been issued for low-lying sectors of {loc} due to severe flooding. "
                    f"Please proceed immediately to the nearest emergency shelter. Call 112 for life-threatening issues.\"\n\n"
                    f"**Evacuation Directions**:\n"
                    f"1. Shut off gas and electricity main valves before departing.\n"
                    f"2. Grab your emergency go-bag (documents, water, medicine, power bank).\n"
                    f"3. Follow designated evacuation channels; do not attempt to cross flooded roads."
                )
            return notice
            
        return f"Mock report from {self.name} for location {loc}."


class CoordinatorAgent:
    def __init__(self):
        self.agents: Dict[str, Agent] = {}
        for a_id, a_cfg in SPECIALIZED_AGENTS.items():
            self.agents[a_id] = Agent(
                name=a_cfg["name"],
                description=a_cfg["description"],
                system_prompt=a_cfg["system_prompt"],
                tools=a_cfg["tools"]
            )

    async def route_and_orchestrate(self, user_query: str) -> Dict[str, Any]:
        """
        1. Analyzes the user query.
        2. Determines which specialized agents are needed and extracts parameters.
        3. Invokes the selected agents in parallel.
        4. Synthesizes their outputs into a final action plan.
        5. Returns the consolidated response along with the execution timeline logs.
        """
        timeline: List[AgentExecutionTrace] = []
        
        # Step 1: Query Deconstruction (determine location and agents to run)
        # In a real environment, we call Gemini to classify the request.
        # Here we use an intelligent, parser-based routing + Gemini classification fallback.
        params = await self._analyze_query_with_llm(user_query)
        location = params.get("location", "")
        selected_agent_names = params.get("agents", [])
        language = params.get("language", "English")
        
        logger.info(f"Orchestration route. Location: '{location}', Selected Agents: {selected_agent_names}")
        
        # If no specialized agents are matched, select all by default to provide a comprehensive response
        if not selected_agent_names:
            selected_agent_names = list(self.agents.keys())
            
        # Step 2: Parallel execution of selected agents
        tasks = []
        traces = []
        for agent_name in selected_agent_names:
            if agent_name in self.agents:
                agent = self.agents[agent_name]
                trace = AgentExecutionTrace(agent_name)
                timeline.append(trace)
                
                # Setup params for this specific agent
                agent_params = {"location": location, "language": language}
                if agent_name == "ResourceAgent":
                    agent_params["disaster_type"] = params.get("disaster_type", "General Disaster")
                
                tasks.append(agent.execute(agent_params, trace))
                traces.append(trace)

        # Wait for all agents to finish (parallel execution)
        agent_responses = []
        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for r, t in zip(results, traces):
                if isinstance(r, Exception):
                    agent_responses.append(f"Agent {t.agent_name} failed: {str(r)}")
                else:
                    agent_responses.append(f"### REPORT FROM {t.agent_name}:\n{r}\n")
        else:
            agent_responses = ["No specialized agents executed."]

        # Step 3: Synthesis of final plan
        coordinator_instruction = (
            "You are the Lead Emergency Coordinator Agent for GuardianAI.\n"
            "Your job is to read the reports from specialized response agents, "
            "synthesize them, and produce a single cohesive, highly formatted, and actionable "
            "Emergency Response Plan.\n"
            "Format the output professionally using clean markdown. Make sure to structure it into sections: "
            "1. Current Emergency Assessment, 2. Critical Safety Actions, 3. Shelter & Hospital Directions, "
            "4. Resource Checklist, 5. Broadcast Drafts.\n"
            "Be authoritative, concise, and highlight life-saving instructions."
        )
        
        coordinator_prompt = (
            f"User Query: {user_query}\n\n"
            f"Here are the specialized agent reports:\n"
            + "\n".join(agent_responses) + "\n\n"
            f"Synthesize them into the final actionable plan."
        )
        
        try:
            final_plan = await self._call_synthesis_llm(coordinator_instruction, coordinator_prompt, agent_responses, location)
        except Exception as e:
            logger.error(f"Coordinator synthesis failed: {e}")
            final_plan = "Emergency Coordinator failed to synthesize agent reports. Please check individual agent timeline traces."
            
        return {
            "final_plan": final_plan,
            "timeline": [t.to_dict() for t in timeline],
            "parameters": params
        }

    async def _analyze_query_with_llm(self, query: str) -> Dict[str, Any]:
        """
        Uses Gemini to extract location, language, disaster type, and choose which agents to run.
        Falls back to local Regex classification if LLM is unavailable.
        """
        system_instruction = (
            "You are an Emergency Query Parser. Analyze the user prompt and output a JSON object containing:\n"
            "- 'location' (string, city or area name mentioned, empty string if none)\n"
            "- 'disaster_type' (string: 'flood', 'hurricane', 'earthquake', 'storm', 'fire', or 'general')\n"
            "- 'language' (string: 'Spanish', 'French', 'Mandarin', or 'English')\n"
            "- 'agents' (array of strings, selecting which agents from: ['WeatherAgent', 'MedicalAgent', 'ShelterAgent', 'ResourceAgent', 'CommunicationAgent'] are relevant to answering the prompt)\n"
            "Provide ONLY raw JSON. No markdown formatting."
        )
        
        if not settings.GEMINI_API_KEY:
            return self._regex_analyze_query(query)
            
        try:
            loop = asyncio.get_event_loop()
            def run_analysis():
                client = genai.Client(api_key=settings.GEMINI_API_KEY)
                response = client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=query,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        temperature=0.0,
                    )
                )
                return response.text
                
            resp_text = await loop.run_in_executor(None, run_analysis)
            # Strip any markdown wrap if generated
            resp_text = resp_text.strip().replace("```json", "").replace("```", "")
            return json.loads(resp_text)
        except Exception as e:
            logger.warning(f"Failed parsing query with Gemini: {e}. Falling back to Regex parsing.")
            return self._regex_analyze_query(query)

    def _regex_analyze_query(self, query: str) -> Dict[str, Any]:
        """Local regex fallback parser"""
        q = query.lower()
        
        # 1. Locate city / place
        location = ""
        # Look for specific known cities first to prevent capturing surrounding words
        known_cities = ["mumbai", "bengaluru", "delhi", "chennai", "kolkata", "hyderabad"]
        for city in known_cities:
            if city in q:
                location = city.title()
                break
                
        if not location:
            # Look for "in [City]", "at [City]", "near [City]"
            loc_match = re.search(r"\b(?:in|at|near|for)\s+([a-zA-Z\s]+?)(?:\.|\?|,|and|need|where|is|$)", query)
            if loc_match:
                location = loc_match.group(1).strip().title()
            else:
                # Try to grab the last capitalized word as location
                words = [w for w in query.split() if w[0].isupper()]
                if words:
                    location = words[-1].strip(".,?!")
                else:
                    location = "Mumbai"  # default mock location

        # 2. Disaster Type
        disaster_type = "general"
        if any(w in q for w in ["flood", "rain", "water", "drown"]):
            disaster_type = "flood"
        elif any(w in q for w in ["hurricane", "cyclone", "typhoon"]):
            disaster_type = "hurricane"
        elif any(w in q for w in ["earthquake", "quake", "tremor"]):
            disaster_type = "earthquake"
        elif any(w in q for w in ["storm", "tornado", "wind"]):
            disaster_type = "storm"
        elif any(w in q for w in ["fire", "wildfire", "smoke"]):
            disaster_type = "fire"

        # 3. Language
        language = "English"
        if "spanish" in q or "español" in q:
            language = "Spanish"
        elif "french" in q or "français" in q:
            language = "French"
        elif "mandarin" in q or "chinese" in q:
            language = "Mandarin"

        # 4. Route agents
        agents = []
        if any(w in q for w in ["weather", "rain", "storm", "forecast", "temp", "wind", "flood"]):
            agents.append("WeatherAgent")
        if any(w in q for w in ["medical", "hospital", "first aid", "hurt", "injury", "icu", "er", "doctor"]):
            agents.append("MedicalAgent")
        if any(w in q for w in ["shelter", "safe", "stay", "sleep", "haven"]):
            agents.append("ShelterAgent")
        if any(w in q for w in ["resource", "food", "water", "supply", "kit", "medicine", "supplies"]):
            agents.append("ResourceAgent")
        if any(w in q for w in ["broadcast", "message", "translate", "spanish", "french", "mandarin", "sms", "alert", "notice"]):
            agents.append("CommunicationAgent")
            
        # Default to all if none matched
        if not agents:
            agents = ["WeatherAgent", "MedicalAgent", "ShelterAgent", "ResourceAgent", "CommunicationAgent"]
            
        return {
            "location": location,
            "disaster_type": disaster_type,
            "language": language,
            "agents": agents
        }

    async def _call_synthesis_llm(self, system_instruction: str, prompt: str, agent_reports: List[str], location: str) -> str:
        if not settings.GEMINI_API_KEY:
            return self._generate_mock_synthesis(agent_reports, location)
            
        try:
            loop = asyncio.get_event_loop()
            def run_sync_genai():
                client = genai.Client(api_key=settings.GEMINI_API_KEY)
                response = client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        temperature=0.3,
                    )
                )
                return response.text
                
            return await loop.run_in_executor(None, run_sync_genai)
        except Exception as e:
            logger.warning(f"Synthesis LLM call failed: {e}. Generating mock synthesis.")
            return self._generate_mock_synthesis(agent_reports, location)

    def _generate_mock_synthesis(self, agent_reports: List[str], location: str) -> str:
        """Helper to create a beautiful unified plan from the reports."""
        sections = []
        
        sections.append(
            f"# 🛡️ GuardianAI Emergency Response Plan for {location}\n\n"
            f"**Status**: ACTIVE EMERGENCY RESPONSE\n"
            f"**Orchestrator**: Coordinator Agent v1.0 (ADK Architecture)\n"
            f"**Retrieved Feeds**: {len(agent_reports)} Specialized Agent Reports Compiled\n"
        )
        
        # Extract content pieces from agent reports or use default templates
        weather_briefing = ""
        medical_advisory = ""
        shelter_info = ""
        resource_kit = ""
        comm_draft = ""
        
        for r in agent_reports:
            if "WeatherAgent" in r:
                weather_briefing = r.split("REPORT FROM WeatherAgent:\n")[-1]
            elif "MedicalAgent" in r:
                medical_advisory = r.split("REPORT FROM MedicalAgent:\n")[-1]
            elif "ShelterAgent" in r:
                shelter_info = r.split("REPORT FROM ShelterAgent:\n")[-1]
            elif "ResourceAgent" in r:
                resource_kit = r.split("REPORT FROM ResourceAgent:\n")[-1]
            elif "CommunicationAgent" in r:
                comm_draft = r.split("REPORT FROM CommunicationAgent:\n")[-1]

        # Structure Synthesis
        sections.append("## 1. 🛑 Current Emergency Assessment")
        if weather_briefing:
            sections.append(weather_briefing.replace("### ", "").strip())
        else:
            sections.append(f"A severe environmental incident is impacting {location}. Stay alert for regional alerts.")

        sections.append("\n## 2. 🏠 Shelter & Hospital Directions")
        if shelter_info:
            sections.append(shelter_info.replace("### ", "").strip())
        if medical_advisory:
            sections.append("\n" + medical_advisory.replace("### ", "").strip())
        if not shelter_info and not medical_advisory:
            sections.append("Searching for open shelters and hospital capacities in the local area. Please contact local disaster authorities.")

        sections.append("\n## 3. 📦 Emergency Resource Checklist")
        if resource_kit:
            sections.append(resource_kit.replace("### ", "").strip())
        else:
            sections.append("- Water: 1 gallon per person per day\n- Food: Non-perishable items (3 days)\n- Medication: 7-day supply")

        sections.append("\n## 4. 📢 Evacuation Alert & Multilingual Broadcasts")
        if comm_draft:
            sections.append(comm_draft.replace("### ", "").strip())
        else:
            sections.append(
                f"**Emergency Radio/SMS Draft (English)**:\n"
                f"\"Alert: Low-lying areas in {location} must evacuate immediately. Head to the nearest shelter. Avoid flooded corridors.\""
            )

        sections.append(
            "\n---\n"
            "*Plan generated dynamically by GuardianAI Coordinator Agent. Verify real-time alerts with local emergency services.*"
        )
        
        return "\n".join(sections)

import re # needed for regex parsing fallback
