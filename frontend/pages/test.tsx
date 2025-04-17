import React from 'react';
import StructureView from '../components/StructureView';

const TestPage: React.FC = () => {
  const sampleContent = `
# Getting Started with the API

Before making API calls, ensure you have an API key.

\`\`\`javascript
// Example of initializing the client
const client = new ApiClient({ 
  apiKey: 'YOUR_API_KEY',
  environment: 'production'
});
\`\`\`

## Authentication

All API requests require authentication using an API key.

\`\`\`typescript
// TypeScript example
interface AuthOptions {
  apiKey: string;
  environment: 'development' | 'production';
}

function authenticate(options: AuthOptions) {
  // Implementation details
  return token;
}
\`\`\`

## Making Requests

The API supports various endpoints:
- /users
- /products
- /orders

\`\`\`python
# Python example
import requests

response = requests.get(
    'https://api.example.com/users',
    headers={'Authorization': 'Bearer ' + api_key}
)
data = response.json()
print(data)
\`\`\`
`;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">StructureView Test</h1>
      <StructureView markdown={sampleContent} />
    </div>
  );
};

export default TestPage; 