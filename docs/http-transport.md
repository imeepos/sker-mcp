# HTTP Transport for Sker MCP

## 📖 Overview

The Sker MCP server now supports HTTP transport using the **MCP Streamable HTTP** protocol specification. This enables real-time communication with MCP clients through HTTP endpoints with optional Server-Sent Events (SSE) streaming.

## 🚀 Quick Start

### Basic HTTP Configuration

Update your configuration to enable HTTP transport:

```json
{
  "server": {
    "transport": {
      "type": "http",
      "host": "localhost",
      "port": 3000
    }
  }
}
```

### Environment Configuration

```bash
export SKER_TRANSPORT_TYPE=http
export SKER_TRANSPORT_HOST=localhost  
export SKER_TRANSPORT_PORT=3000
```

### Starting the Server

```bash
# Using the CLI
sker --transport http --port 3000

# Using npm script
npm start
```

The server will start and display:
```
HTTP transport started successfully { host: 'localhost', port: 3000, pid: 12345 }
MCP server available at: http://localhost:3000/mcp
Health check available at: http://localhost:3000/health
```

## 🔧 Configuration

### Complete HTTP Configuration

```json
{
  "server": {
    "name": "my-mcp-server",
    "version": "1.0.0", 
    "transport": {
      "type": "http",
      "host": "localhost",
      "port": 3000,
      "http": {
        "cors": true,
        "corsOrigins": ["*"],
        "enableSessions": true,
        "enableJsonResponse": false,
        "requestTimeout": 30000,
        "maxBodySize": "10MB",
        "enableDnsRebindingProtection": false,
        "allowedHosts": [],
        "allowedOrigins": []
      }
    }
  }
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `host` | string | `"localhost"` | Server hostname |
| `port` | number | `3000` | Server port |
| `cors` | boolean | `true` | Enable CORS support |
| `corsOrigins` | string[] | `["*"]` | Allowed CORS origins |
| `enableSessions` | boolean | `true` | Enable session management |
| `enableJsonResponse` | boolean | `false` | Use JSON responses instead of SSE |
| `requestTimeout` | number | `30000` | Request timeout (ms) |
| `maxBodySize` | string | `"10MB"` | Maximum request body size |
| `enableDnsRebindingProtection` | boolean | `false` | Enable DNS rebinding protection |
| `allowedHosts` | string[] | `[]` | Allowed hosts for DNS protection |
| `allowedOrigins` | string[] | `[]` | Allowed origins for DNS protection |

## 🌐 API Endpoints

### MCP Endpoint
- **URL**: `/mcp`
- **Methods**: `GET`, `POST`, `DELETE`, `OPTIONS`
- **Description**: Main MCP protocol endpoint

#### GET Request (SSE Stream)
```bash
curl -N -H "Accept: text/event-stream" http://localhost:3000/mcp
```

#### POST Request (JSON-RPC)
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

### Health Check Endpoint
- **URL**: `/health`
- **Method**: `GET`
- **Description**: Server health status

```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "transport": {
    "status": "running",
    "sessionId": "uuid-here",
    "config": {
      "host": "localhost",
      "port": 3000,
      "enableSessions": true,
      "enableJsonResponse": false
    }
  }
}
```

## 🔄 Transport Modes

### SSE Streaming Mode (Default)
Real-time bidirectional communication using Server-Sent Events:

```javascript
const eventSource = new EventSource('http://localhost:3000/mcp');

eventSource.onmessage = function(event) {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};

// Send requests via POST
fetch('http://localhost:3000/mcp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/list',
    id: 1
  })
});
```

### JSON Response Mode
Simple request-response without streaming:

```json
{
  "server": {
    "transport": {
      "type": "http",
      "http": {
        "enableJsonResponse": true
      }
    }
  }
}
```

```javascript
const response = await fetch('http://localhost:3000/mcp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/list', 
    id: 1
  })
});

const result = await response.json();
console.log(result);
```

## 🔐 Security Features

### CORS Configuration
```json
{
  "http": {
    "cors": true,
    "corsOrigins": [
      "http://localhost:3000",
      "https://myapp.com"
    ]
  }
}
```

### DNS Rebinding Protection
```json
{
  "http": {
    "enableDnsRebindingProtection": true,
    "allowedHosts": [
      "localhost",
      "127.0.0.1",
      "myserver.com"
    ],
    "allowedOrigins": [
      "http://localhost:3000",
      "https://myapp.com"
    ]
  }
}
```

## 📊 Session Management

### Stateful Mode (Default)
Server manages sessions with unique session IDs:

```bash
# First request creates session
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{},"id":1}'

# Response includes session ID
# X-MCP-Session-ID: 12345678-1234-1234-1234-123456789abc

# Subsequent requests include session ID
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "X-MCP-Session-ID: 12345678-1234-1234-1234-123456789abc" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":2}'
```

### Stateless Mode
Disable sessions for stateless operation:

```json
{
  "http": {
    "enableSessions": false
  }
}
```

## 🛠️ Client Implementation Examples

### JavaScript/TypeScript Client
```typescript
class McpHttpClient {
  private baseUrl: string;
  private sessionId?: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async initialize() {
    const response = await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {}
    });
    
    this.sessionId = response.headers.get('X-MCP-Session-ID') || undefined;
    return response;
  }

  async listTools() {
    return this.sendRequest('tools/list', {});
  }

  async callTool(name: string, arguments: any) {
    return this.sendRequest('tools/call', {
      name,
      arguments
    });
  }

  private async sendRequest(method: string, params: any) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.sessionId) {
      headers['X-MCP-Session-ID'] = this.sessionId;
    }

    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        method,
        params,
        id: Math.random()
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }
}

// Usage
const client = new McpHttpClient('http://localhost:3000');
await client.initialize();
const tools = await client.listTools();
console.log('Available tools:', tools.result.tools);
```

### Python Client
```python
import requests
import json
import uuid

class McpHttpClient:
    def __init__(self, base_url):
        self.base_url = base_url
        self.session_id = None
        
    def initialize(self):
        response = self.send_request('initialize', {
            'protocolVersion': '2024-11-05',
            'capabilities': {}
        })
        
        self.session_id = response.headers.get('X-MCP-Session-ID')
        return response.json()
        
    def list_tools(self):
        response = self.send_request('tools/list', {})
        return response.json()
        
    def call_tool(self, name, arguments):
        response = self.send_request('tools/call', {
            'name': name,
            'arguments': arguments
        })
        return response.json()
        
    def send_request(self, method, params):
        headers = {'Content-Type': 'application/json'}
        
        if self.session_id:
            headers['X-MCP-Session-ID'] = self.session_id
            
        data = {
            'jsonrpc': '2.0',
            'method': method,
            'params': params,
            'id': str(uuid.uuid4())
        }
        
        response = requests.post(
            f'{self.base_url}/mcp',
            headers=headers,
            data=json.dumps(data)
        )
        
        response.raise_for_status()
        return response

# Usage
client = McpHttpClient('http://localhost:3000')
client.initialize()
tools = client.list_tools()
print('Available tools:', tools['result']['tools'])
```

## 📈 Monitoring & Debugging

### Request Logging
All HTTP requests are logged with request IDs for tracing:

```json
{
  "level": "debug",
  "message": "HTTP request received",
  "method": "POST",
  "url": "/mcp",
  "requestId": "req-12345",
  "sessionId": "sess-67890",
  "userAgent": "MyClient/1.0.0",
  "contentType": "application/json"
}
```

### Health Monitoring
Monitor server health via the health endpoint:

```bash
# Basic health check
curl http://localhost:3000/health

# With jq for pretty output
curl -s http://localhost:3000/health | jq '.'
```

### Error Handling
The server provides detailed error responses:

```json
{
  "error": "Invalid JSON payload",
  "code": "PARSE_ERROR",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "requestId": "req-12345"
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad Request (invalid JSON, missing parameters)
- `404` - Not Found (invalid session, unknown route)
- `408` - Request Timeout
- `413` - Payload Too Large
- `500` - Internal Server Error

## 🚀 Performance Considerations

### Concurrent Connections
The HTTP transport supports multiple concurrent connections with session isolation.

### Memory Usage
- Sessions are stored in memory
- Each session maintains connection state
- Use stateless mode for high-traffic scenarios

### Scaling
- Single server instance per port
- Use reverse proxy (nginx) for load balancing
- Consider connection limits and timeouts

## 🔧 Troubleshooting

### Common Issues

#### Port Already in Use
```
Error: listen EADDRINUSE :::3000
```
**Solution**: Change port in configuration or stop the conflicting service.

#### CORS Errors
```
Access to fetch at 'http://localhost:3000/mcp' from origin 'http://localhost:8080' has been blocked by CORS policy
```
**Solution**: Add the origin to `corsOrigins` configuration.

#### Session Not Found
```
HTTP 404: Session not found
```
**Solution**: Ensure session ID is included in requests or disable sessions.

#### Request Too Large
```
HTTP 413: Request entity too large
```
**Solution**: Increase `maxBodySize` configuration.

### Debug Mode
Enable debug logging for detailed request/response information:

```json
{
  "logging": {
    "level": "debug"
  }
}
```

## 📚 Additional Resources

- [MCP Protocol Specification](https://spec.modelcontextprotocol.io/)
- [MCP Streamable HTTP Transport](https://spec.modelcontextprotocol.io/specification/server/#streamable-http-transport)
- [Server-Sent Events (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)

---

For more information about the Sker MCP system, see the [Core Architecture](./core-architecture.md) documentation.