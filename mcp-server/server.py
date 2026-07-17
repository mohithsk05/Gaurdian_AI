import sys
import json
import logging
import traceback
from typing import Dict, Any, List

# Set up logging to stderr (so it doesn't pollute stdout JSON-RPC stream)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    stream=sys.stderr
)
logger = logging.getLogger("guardian_mcp_server")

# Mock Database
WEATHER_DB = {
    "mumbai": {
        "location": "Mumbai, MH",
        "status": "Monsoon Flash Flood Warning & High Winds",
        "temperature": "29°C (84°F)",
        "precipitation": "Torrential Rain, 22mm/hr",
        "wind_speed": "35 km/h, gusts to 55 km/h",
        "alerts": ["Severe Flash Flood Warning (Zone 1 & 2)", "High Wind Advisory"]
    },
    "bengaluru": {
        "location": "Bengaluru, KA",
        "status": "Severe Thunderstorm Warning Active",
        "temperature": "22°C (71°F)",
        "precipitation": "Heavy Downpours, 12mm/hr",
        "wind_speed": "55 km/h, gusts to 80 km/h",
        "alerts": ["Thunderstorm warning (Koramangala/Whitefield)", "High Gale Wind Alert"]
    },
    "delhi": {
        "location": "Delhi, DL",
        "status": "Extreme Heat Wave Warning",
        "temperature": "44°C (111°F)",
        "precipitation": "Dry, 0mm/hr",
        "wind_speed": "20 km/h",
        "alerts": ["Severe Heat Wave Advisory (Red Alert)"]
    }
}

HOSPITAL_DB = {
    "mumbai": [
        {
            "name": "KEM Hospital & Medical College",
            "distance": "0.8 km",
            "icu_bed_capacity": "14 available",
            "er_wait_time": "12 mins",
            "specialties": ["Trauma Care", "Emergency Surgery", "Tropical Disease Unit"],
            "status": "CRITICAL CAPACITY - EMERGENCY ONLY",
            "coordinates": {"lat": 19.0028, "lng": 72.8420}
        },
        {
            "name": "Lilavati Hospital & Research Centre",
            "distance": "4.1 km",
            "icu_bed_capacity": "32 available",
            "er_wait_time": "45 mins",
            "specialties": ["General Emergency", "Cardiology", "First Aid Support"],
            "status": "NORMAL OPERATION",
            "coordinates": {"lat": 19.0514, "lng": 72.8267}
        }
    ],
    "bengaluru": [
        {
            "name": "Manipal Hospital Old Airport Road",
            "distance": "1.5 km",
            "icu_bed_capacity": "5 available",
            "er_wait_time": "8 mins",
            "specialties": ["Trauma Level 1", "Emergency Surgery", "Intensive Care"],
            "status": "CRITICAL CAPACITY - STORM EMERGENCY ACTIVE",
            "coordinates": {"lat": 12.9592, "lng": 77.6450}
        },
        {
            "name": "Narayana Health City",
            "distance": "5.6 km",
            "icu_bed_capacity": "19 available",
            "er_wait_time": "25 mins",
            "specialties": ["General Emergency", "Triage Care", "Pediatrics"],
            "status": "NORMAL OPERATION",
            "coordinates": {"lat": 12.8090, "lng": 77.6950}
        }
    ]
}

PLACES_DB = {
    "mumbai": [
        {
            "name": "Dharavi Community Center Shelter",
            "type": "Shelter",
            "status": "OPEN",
            "distance": "1.2 km",
            "coordinates": {"lat": 19.0380, "lng": 72.8538},
            "capacity": "85/150 occupied",
            "notes": "Accepts pets. Supplies: Cots, water, blankets, hot meals."
        },
        {
            "name": "Bandra Municipal School Relief Zone",
            "type": "Shelter",
            "status": "OPEN",
            "distance": "3.5 km",
            "coordinates": {"lat": 19.0596, "lng": 72.8295},
            "capacity": "42/100 occupied",
            "notes": "Medical first-aid staff on site. Service animals only."
        }
    ],
    "bengaluru": [
        {
            "name": "Koramangala Community cot Haven",
            "type": "Shelter",
            "status": "OPEN",
            "distance": "2.1 km",
            "coordinates": {"lat": 12.9352, "lng": 77.6244},
            "capacity": "180/300 occupied",
            "notes": "Backup generators active. Accepts pets."
        },
        {
            "name": "Whitefield Relief Camp",
            "type": "Shelter",
            "status": "FULL",
            "distance": "4.8 km",
            "coordinates": {"lat": 12.9698, "lng": 77.7500},
            "capacity": "250/250 occupied",
            "notes": "At maximum capacity. Diverting newcomers to Koramangala."
        }
    ]
}

DISASTER_ALERTS_DB = {
    "mumbai": [
        {
            "id": "ALERT-092",
            "type": "Flash Flood Warning",
            "severity": "CRITICAL",
            "issued_by": "India Meteorological Department",
            "message": "Severe water-logging expected in low-lying sectors of Mumbai due to heavy monsoon downpours. Evacuate low zones.",
            "timestamp": "2026-07-06T12:00:00Z"
        }
    ],
    "bengaluru": [
        {
            "id": "ALERT-044",
            "type": "Gale Wind Warning",
            "severity": "CRITICAL",
            "issued_by": "India Meteorological Department",
            "message": "Severe thunderstorm with gale-force winds up to 80 km/h expected to strike Bengaluru sectors. Stay indoors.",
            "timestamp": "2026-07-06T14:30:00Z"
        }
    ]
}

HELPLINE_DB = {
    "mumbai": {
        "region": "Mumbai, MH",
        "contacts": [
            {"name": "Mumbai Disaster Control Room", "number": "022-22694727", "hours": "24/7"},
            {"name": "NDRF Control Room (Maharashtra)", "number": "022-22027990", "hours": "24/7"},
            {"name": "NDMA National Helpline", "number": "011-26701728", "hours": "24/7"},
            {"name": "National Emergency Service", "number": "112", "hours": "24/7"}
        ]
    },
    "bengaluru": {
        "region": "Bengaluru, KA",
        "contacts": [
            {"name": "Bengaluru Disaster Control Room", "number": "080-22221188", "hours": "24/7"},
            {"name": "NDRF Control Room (Karnataka)", "number": "080-22238477", "hours": "24/7"},
            {"name": "State Emergency Operations Helpline", "number": "1070", "hours": "24/7"},
            {"name": "National Emergency Service", "number": "112", "hours": "24/7"}
        ]
    }
}

# General Fallback Creators for other locations
def get_generic_weather(location: str) -> Dict[str, Any]:
    return {
        "location": location,
        "status": "Disaster Preparedness Alert Active",
        "temperature": "18°C (64°F)",
        "precipitation": "Heavy Showers, 10mm/hr",
        "wind_speed": "40 km/h",
        "alerts": ["Severe Weather Warning", "Flash Flood Watch"]
    }

def get_generic_hospitals(location: str) -> List[Dict[str, Any]]:
    return [
        {
            "name": f"{location} Central Emergency Clinic",
            "distance": "1.8 km",
            "icu_bed_capacity": "8 available",
            "er_wait_time": "15 mins",
            "specialties": ["Triage", "General Emergency", "Minor Trauma"],
            "status": "NORMAL OPERATION",
            "coordinates": {"lat": 47.6000, "lng": -122.3000}
        }
    ]

def get_generic_shelters(location: str) -> List[Dict[str, Any]]:
    return [
        {
            "name": f"{location} Municipal Gym Safe Zone",
            "type": "Shelter",
            "status": "OPEN",
            "distance": "2.5 km",
            "coordinates": {"lat": 47.6050, "lng": -122.3100},
            "capacity": "30/100 occupied",
            "notes": "Accepts service animals only. Cots and water available."
        }
    ]

def get_generic_alerts(location: str) -> List[Dict[str, Any]]:
    return [
        {
            "id": "ALERT-GEN",
            "type": "Weather and Safety Advisory",
            "severity": "MEDIUM",
            "issued_by": "State Emergency Agency",
            "message": f"Stay informed of localized hazards in {location}. Secure lightweight objects outdoors and monitor communication lines.",
            "timestamp": "2026-07-06T15:00:00Z"
        }
    ]

def get_generic_helplines(region: str) -> Dict[str, Any]:
    return {
        "region": region,
        "contacts": [
            {"name": "Federal Disaster Support", "number": "1-800-621-FEMA", "hours": "24/7"},
            {"name": "National Poison Control", "number": "1-800-222-1222", "hours": "24/7"},
            {"name": "Disaster Distress Helpline", "number": "1-800-985-5990", "hours": "24/7"}
        ]
    }

# --- TOOL IMPLEMENTATION DISPATCHERS ---

def get_weather(location: str) -> Dict[str, Any]:
    loc_key = location.lower().split(",")[0].strip()
    return WEATHER_DB.get(loc_key, get_generic_weather(location))

def search_places(location: str, query: str) -> Dict[str, Any]:
    loc_key = location.lower().split(",")[0].strip()
    places = PLACES_DB.get(loc_key, get_generic_shelters(location))
    return {
        "search_query": query,
        "location": location,
        "results": places
    }

def lookup_hospitals(location: str) -> Dict[str, Any]:
    loc_key = location.lower().split(",")[0].strip()
    hospitals = HOSPITAL_DB.get(loc_key, get_generic_hospitals(location))
    return {
        "location": location,
        "hospitals": hospitals
    }

def get_disaster_alerts(location: str) -> Dict[str, Any]:
    loc_key = location.lower().split(",")[0].strip()
    alerts = DISASTER_ALERTS_DB.get(loc_key, get_generic_alerts(location))
    return {
        "location": location,
        "alerts": alerts
    }

def get_emergency_helplines(region: str) -> Dict[str, Any]:
    loc_key = region.lower().split(",")[0].strip()
    return HELPLINE_DB.get(loc_key, get_generic_helplines(region))

# --- MCP PROTOCOL SCHEMAS ---

TOOLS_SCHEMA = [
    {
        "name": "get_weather",
        "description": "Retrieve live weather forecasts, wind speeds, and temperature data for a specific location.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "The city and/or state to retrieve weather details for (e.g. Seattle, WA)."
                }
            },
            "required": ["location"]
        }
    },
    {
        "name": "search_places",
        "description": "Query Google Maps / Places database to identify shelter locations, community safe zones, and safe havens.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "The city or coordinates region to query shelters in."
                },
                "query": {
                    "type": "string",
                    "description": "Search keyword like 'shelter', 'safe zone' or 'safe haven'."
                }
            },
            "required": ["location", "query"]
        }
    },
    {
        "name": "lookup_hospitals",
        "description": "Lookup local hospital directory with exact distances, ER wait times, and ICU bed capacities.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "The city to lookup hospital capacities for."
                }
            },
            "required": ["location"]
        }
    },
    {
        "name": "get_disaster_alerts",
        "description": "Retrieve official government disaster notices, flash flood advisories, and active warning feeds.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "The regional zone to pull disaster notices for."
                }
            },
            "required": ["location"]
        }
    },
    {
        "name": "get_emergency_helplines",
        "description": "Retrieve a dedicated directory of emergency helper organizations, fire departments, and mental crisis support hotlines.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "region": {
                    "type": "string",
                    "description": "The region name or state directory to query."
                }
            },
            "required": ["region"]
        }
    }
]

# --- MAIN STDIO JSON-RPC LOOP ---

def write_json_response(payload: Dict[str, Any]):
    sys.stdout.write(json.dumps(payload) + "\n")
    sys.stdout.flush()

def main():
    logger.info("Guardian MCP Server process started.")
    
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                break
                
            line = line.strip()
            if not line:
                continue
                
            try:
                request = json.loads(line)
            except json.JSONDecodeError:
                logger.error(f"Invalid JSON received: {line}")
                continue
                
            req_id = request.get("id")
            method = request.get("method")
            params = request.get("params", {})
            
            # Protocol Routing
            if method == "initialize":
                response = {
                    "jsonrpc": "2.0",
                    "result": {
                        "protocolVersion": "2024-11-05",
                        "capabilities": {
                            "tools": {}
                        },
                        "serverInfo": {
                            "name": "guardian-mcp-server",
                            "version": "1.0.0"
                        }
                    },
                    "id": req_id
                }
                write_json_response(response)
                
            elif method == "initialized":
                # Notification, no response needed
                logger.info("Handshake complete. Server initialized.")
                
            elif method == "tools/list":
                response = {
                    "jsonrpc": "2.0",
                    "result": {
                        "tools": TOOLS_SCHEMA
                    },
                    "id": req_id
                }
                write_json_response(response)
                
            elif method == "tools/call":
                tool_name = params.get("name")
                arguments = params.get("arguments", {})
                
                logger.info(f"Tool execution requested: {tool_name} with args: {arguments}")
                
                try:
                    result_data = None
                    if tool_name == "get_weather":
                        result_data = get_weather(arguments.get("location", ""))
                    elif tool_name == "search_places":
                        result_data = search_places(arguments.get("location", ""), arguments.get("query", ""))
                    elif tool_name == "lookup_hospitals":
                        result_data = lookup_hospitals(arguments.get("location", ""))
                    elif tool_name == "get_disaster_alerts":
                        result_data = get_disaster_alerts(arguments.get("location", ""))
                    elif tool_name == "get_emergency_helplines":
                        result_data = get_emergency_helplines(arguments.get("region", ""))
                    else:
                        raise ValueError(f"Unknown tool: {tool_name}")
                        
                    response = {
                        "jsonrpc": "2.0",
                        "result": {
                            "content": [
                                {
                                    "type": "text",
                                    "text": json.dumps(result_data, indent=2)
                                }
                            ],
                            "isError": False
                        },
                        "id": req_id
                    }
                except Exception as tool_err:
                    logger.error(f"Error executing tool {tool_name}: {tool_err}")
                    response = {
                        "jsonrpc": "2.0",
                        "result": {
                            "content": [
                                {
                                    "type": "text",
                                    "text": f"Error executing tool: {str(tool_err)}"
                                }
                            ],
                            "isError": True
                        },
                        "id": req_id
                    }
                    
                write_json_response(response)
            else:
                # Unsupported method
                if req_id is not None:
                    response = {
                        "jsonrpc": "2.0",
                        "error": {
                            "code": -32601,
                            "message": f"Method not found: {method}"
                        },
                        "id": req_id
                    }
                    write_json_response(response)
                    
        except Exception as loop_err:
            logger.error(f"Unexpected exception in stdin loop: {loop_err}\n{traceback.format_exc()}")
            
    logger.info("Guardian MCP Server process shutting down.")

if __name__ == "__main__":
    main()
