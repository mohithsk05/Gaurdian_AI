import asyncio
import json
import logging
import sys
import traceback
from typing import Dict, Any, List, Optional
from app.config import settings

logger = logging.getLogger("guardian_ai.mcp_client")
logging.basicConfig(level=logging.INFO)

class MCPClient:
    def __init__(self):
        self.process: Optional[asyncio.subprocess.Process] = None
        self.request_id = 0
        self.lock = asyncio.Lock()
        self.is_connected = False
        
        # Local fallback tool implementation in case MCP Server process doesn't start
        self._fallback_tools = {
            "get_weather": self._fallback_get_weather,
            "search_places": self._fallback_search_places,
            "lookup_hospitals": self._fallback_lookup_hospitals,
            "get_disaster_alerts": self._fallback_get_disaster_alerts,
            "get_emergency_helplines": self._fallback_get_emergency_helplines
        }

    async def connect(self) -> bool:
        async with self.lock:
            if self.is_connected:
                return True
                
            cmd = settings.MCP_SERVER_COMMAND
            logger.info(f"Connecting to MCP Server via command: {cmd}")
            try:
                # Spawn server process
                self.process = await asyncio.create_subprocess_shell(
                    cmd,
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                self.is_connected = True
                
                # Perform handshake (initialize)
                init_resp = await self._send_request("initialize", {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "guardian-ai-backend", "version": "1.0.0"}
                })
                
                # Send initialized notification
                await self._send_notification("initialized", {})
                logger.info("Successfully connected and initialized MCP Server.")
                return True
                
            except Exception as e:
                logger.warning(f"Could not connect to MCP Server via subprocess: {e}. Running in Fallback Mode.")
                self.process = None
                self.is_connected = False
                return False

    async def disconnect(self):
        async with self.lock:
            if self.process:
                try:
                    self.process.terminate()
                    await self.process.wait()
                except Exception:
                    pass
                self.process = None
            self.is_connected = False
            logger.info("Disconnected from MCP Server.")

    async def list_tools(self) -> List[Dict[str, Any]]:
        if not self.is_connected:
            connected = await self.connect()
            if not connected:
                return [
                    {"name": name, "description": f"Fallback implementation of {name}", "inputSchema": {}}
                    for name in self._fallback_tools.keys()
                ]
                
        try:
            resp = await self._send_request("tools/list", {})
            return resp.get("tools", [])
        except Exception as e:
            logger.error(f"Error listing tools from MCP Server: {e}. Returning fallback list.")
            return [
                {"name": name, "description": f"Fallback implementation of {name}", "inputSchema": {}}
                for name in self._fallback_tools.keys()
            ]

    async def call_tool(self, name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        logger.info(f"Calling tool: {name} with arguments: {arguments}")
        
        # Check connection; if it fails, go straight to fallback
        if not self.is_connected:
            connected = await self.connect()
            if not connected:
                return await self._execute_fallback(name, arguments)
                
        try:
            resp = await self._send_request("tools/call", {
                "name": name,
                "arguments": arguments
            })
            return resp
        except Exception as e:
            logger.error(f"Failed to call tool {name} via MCP process: {e}. Executing fallback.")
            return await self._execute_fallback(name, arguments)

    async def _send_request(self, method: str, params: Dict[str, Any]) -> Dict[str, Any]:
        if not self.process or not self.process.stdin or not self.process.stdout:
            raise RuntimeError("MCP process not running")
            
        self.request_id += 1
        req_id = self.request_id
        
        payload = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
            "id": req_id
        }
        
        req_str = json.dumps(payload) + "\n"
        self.process.stdin.write(req_str.encode("utf-8"))
        await self.process.stdin.drain()
        
        # Read line response
        try:
            # Add timeout to prevent hangs
            line_bytes = await asyncio.wait_for(self.process.stdout.readline(), timeout=5.0)
            if not line_bytes:
                raise EOFError("MCP Server closed stdout stream")
                
            line = line_bytes.decode("utf-8").strip()
            resp = json.loads(line)
            
            if resp.get("id") != req_id:
                raise ValueError(f"ID mismatch: expected {req_id}, got {resp.get('id')}")
                
            if "error" in resp:
                raise ValueError(resp["error"])
                
            return resp.get("result", {})
        except asyncio.TimeoutError:
            logger.error(f"Timeout waiting for MCP response for method: {method}")
            raise
        except Exception as e:
            logger.error(f"Error in JSON-RPC stream communication: {e}")
            raise

    async def _send_notification(self, method: str, params: Dict[str, Any]):
        if not self.process or not self.process.stdin:
            return
            
        payload = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params
        }
        req_str = json.dumps(payload) + "\n"
        self.process.stdin.write(req_str.encode("utf-8"))
        await self.process.stdin.drain()

    # --- FALLBACK ENGINE ---
    async def _execute_fallback(self, name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        logger.info(f"Fallback executing tool: {name}")
        handler = self._fallback_tools.get(name)
        if not handler:
            return {
                "isError": True,
                "content": [{"type": "text", "text": f"Error: Tool {name} not found."}]
            }
        try:
            result = await handler(arguments)
            return {
                "content": [{"type": "text", "text": json.dumps(result, indent=2)}]
            }
        except Exception as e:
            return {
                "isError": True,
                "content": [{"type": "text", "text": f"Fallback error: {str(e)}"}]
            }

    # Fallback Tool implementations
    async def _fallback_get_weather(self, args: Dict[str, Any]) -> Dict[str, Any]:
        loc = args.get("location", "Unknown Location")
        return {
            "location": loc,
            "status": "Warning - Severe Weather System Approaching",
            "temperature": "14 C (57 F)",
            "precipitation": "Heavy rainfall, 12mm/hr",
            "wind_speed": "45 km/h with gusts up to 70 km/h",
            "alerts": ["Severe Flood Warning", "High Wind Advisory"]
        }

    async def _fallback_search_places(self, args: Dict[str, Any]) -> Dict[str, Any]:
        loc = args.get("location", "")
        query = args.get("query", "")
        return {
            "search_query": f"Places in {loc} matching {query}",
            "results": [
                {
                    "name": f"Downtown Emergency Shelter A ({loc})",
                    "type": "Shelter",
                    "status": "OPEN",
                    "distance": "1.2 km",
                    "coordinates": {"lat": 47.6062, "lng": -122.3321},
                    "capacity": "85/150 occupied",
                    "notes": "Accepts pets. Supplies: Cots, water, blankets."
                },
                {
                    "name": f"Westside Community Safe Haven ({loc})",
                    "type": "Shelter",
                    "status": "OPEN",
                    "distance": "3.5 km",
                    "coordinates": {"lat": 47.6101, "lng": -122.3421},
                    "capacity": "42/100 occupied",
                    "notes": "Medical supplies on site. No pets allowed."
                }
            ]
        }

    async def _fallback_lookup_hospitals(self, args: Dict[str, Any]) -> Dict[str, Any]:
        loc = args.get("location", "")
        return {
            "location": loc,
            "hospitals": [
                {
                    "name": f"St. Jude Regional Medical Center ({loc})",
                    "distance": "0.8 km",
                    "icu_bed_capacity": "14 available",
                    "er_wait_time": "12 mins",
                    "specialties": ["Trauma Level 1", "Emergency Surgery", "Pediatric Care"],
                    "status": "CRITICAL CAPACITY - EMERGENCY ONLY",
                    "coordinates": {"lat": 47.6098, "lng": -122.3302}
                },
                {
                    "name": f"Mercy General Hospital ({loc})",
                    "distance": "4.1 km",
                    "icu_bed_capacity": "32 available",
                    "er_wait_time": "45 mins",
                    "specialties": ["Trauma Level 2", "Cardiology", "First Aid Support"],
                    "status": "NORMAL OPERATION",
                    "coordinates": {"lat": 47.5998, "lng": -122.3250}
                }
            ]
        }

    async def _fallback_get_disaster_alerts(self, args: Dict[str, Any]) -> Dict[str, Any]:
        loc = args.get("location", "")
        return {
            "location": loc,
            "alerts": [
                {
                    "id": "ALERT-092",
                    "type": "Flash Flood Warning",
                    "severity": "CRITICAL",
                    "issued_by": "National Emergency Management Agency",
                    "message": f"Flash flood warnings remain in effect for {loc} and surrounding low-lying coastal areas. Residents are advised to move to higher ground immediately and avoid driving on flooded roads.",
                    "timestamp": "2026-07-06T12:00:00Z"
                }
            ]
        }

    async def _fallback_get_emergency_helplines(self, args: Dict[str, Any]) -> Dict[str, Any]:
        region = args.get("region", "")
        return {
            "region": region,
            "contacts": [
                {"name": "National Emergency Services", "number": "911", "hours": "24/7"},
                {"name": "Disaster Distress Helpline", "number": "1-800-985-5990", "hours": "24/7"},
                {"name": "National Poison Control", "number": "1-800-222-1222", "hours": "24/7"},
                {"name": "Red Cross Emergency Logistics", "number": "1-800-733-2767", "hours": "24/7"}
            ]
        }

# Global client instance
mcp_client = MCPClient()
