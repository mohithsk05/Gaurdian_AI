import pytest
import json
from app.mcp.mcp_client import MCPClient

@pytest.fixture
def mcp_client():
    return MCPClient()

@pytest.mark.asyncio
async def test_fallback_get_weather(mcp_client):
    # Test that the fallback handler executes successfully for get_weather
    result = await mcp_client.call_tool("get_weather", {"location": "Mumbai"})
    assert result.get("isError") is not True
    content = result.get("content", [])
    assert len(content) > 0
    
    text = content[0].get("text", "")
    data = json.loads(text)
    assert "Mumbai" in data["location"]
    assert "status" in data
    assert "precipitation" in data

@pytest.mark.asyncio
async def test_fallback_search_places(mcp_client):
    # Test fallback handler for search_places
    result = await mcp_client.call_tool("search_places", {"location": "Mumbai", "query": "shelter"})
    assert result.get("isError") is not True
    content = result.get("content", [])
    assert len(content) > 0
    
    text = content[0].get("text", "")
    data = json.loads(text)
    assert "results" in data
    assert len(data["results"]) > 0
    assert data["results"][0]["type"] == "Shelter"

@pytest.mark.asyncio
async def test_fallback_lookup_hospitals(mcp_client):
    # Test fallback handler for lookup_hospitals
    result = await mcp_client.call_tool("lookup_hospitals", {"location": "Bengaluru"})
    assert result.get("isError") is not True
    content = result.get("content", [])
    assert len(content) > 0
    
    text = content[0].get("text", "")
    data = json.loads(text)
    assert "hospitals" in data
    assert len(data["hospitals"]) > 0
    assert "er_wait_time" in data["hospitals"][0]

@pytest.mark.asyncio
async def test_fallback_invalid_tool(mcp_client):
    # Test that executing an unknown tool returns an error payload gracefully
    result = await mcp_client.call_tool("unknown_tool_name", {})
    assert result.get("isError") is True
    content = result.get("content", [])
    assert "unknown_tool_name" in content[0].get("text", "")
