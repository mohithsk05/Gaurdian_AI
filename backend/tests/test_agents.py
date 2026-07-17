import pytest
from app.agents.adk_orchestration import CoordinatorAgent, Agent, AgentExecutionTrace
from app.agents.specialized_agents import SPECIALIZED_AGENTS

@pytest.fixture
def coordinator():
    return CoordinatorAgent()

def test_agent_initialization(coordinator):
    assert len(coordinator.agents) == 5
    assert "WeatherAgent" in coordinator.agents
    assert "MedicalAgent" in coordinator.agents
    
    weather_agent = coordinator.agents["WeatherAgent"]
    assert weather_agent.name == "WeatherAgent"
    assert "get_weather" in weather_agent.tools
    assert "get_disaster_alerts" in weather_agent.tools

def test_regex_query_routing(coordinator):
    # Test weather query
    params = coordinator._regex_analyze_query("What is the weather forecast for Mumbai?")
    assert params["location"] == "Mumbai"
    assert "WeatherAgent" in params["agents"]
    
    # Test medical query
    params = coordinator._regex_analyze_query("I need first aid guidelines for bleeding in Delhi")
    assert params["location"] == "Delhi"
    assert "MedicalAgent" in params["agents"]
    
    # Test shelter query
    params = coordinator._regex_analyze_query("Where is the nearest shelter in Bengaluru?")
    assert params["location"] == "Bengaluru"
    assert "ShelterAgent" in params["agents"]

@pytest.mark.asyncio
async def test_agent_execution_mock():
    # Test execution of Weather Agent with mock data (since api key is empty)
    agent_cfg = SPECIALIZED_AGENTS["WeatherAgent"]
    agent = Agent(
        name=agent_cfg["name"],
        description=agent_cfg["description"],
        system_prompt=agent_cfg["system_prompt"],
        tools=agent_cfg["tools"]
    )
    
    trace = AgentExecutionTrace(agent.name)
    params = {"location": "Mumbai", "language": "English"}
    
    response = await agent.execute(params, trace)
    assert "Weather & Alert Briefing" in response
    assert trace.status == "COMPLETED"
    assert len(trace.tool_calls) > 0
    assert trace.tool_calls[0]["tool_name"] == "get_weather"

@pytest.mark.asyncio
async def test_coordinator_orchestrate_mock(coordinator):
    # Simulate a full user interaction
    query = "A severe flood is hitting Mumbai. Find open shelters and first aid tips."
    result = await coordinator.route_and_orchestrate(query)
    
    assert "final_plan" in result
    assert "timeline" in result
    assert "parameters" in result
    
    # Verify final plan structure
    final_plan = result["final_plan"]
    assert "# 🛡️" in final_plan
    assert "Mumbai" in final_plan
    assert "Shelter" in final_plan or "Hospital" in final_plan
    
    # Verify timeline traces are logged
    timeline = result["timeline"]
    assert len(timeline) > 0
    # Both WeatherAgent, MedicalAgent, ShelterAgent etc. should have execution traces
    agent_names = [t["agent_name"] for t in timeline]
    assert "WeatherAgent" in agent_names
    assert "ShelterAgent" in agent_names
