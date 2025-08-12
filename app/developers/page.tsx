'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CodeBracketIcon,
  DocumentTextIcon,
  KeyIcon,
  PlayIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  BeakerIcon,
  BoltIcon,
  ShieldCheckIcon,
  CursorArrowRaysIcon,
} from '@heroicons/react/24/outline';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface APIEndpoint {
  path: string;
  method: string;
  description: string;
  params?: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
    example?: any;
  }>;
  body?: object;
  response: object;
  auth?: boolean;
}

interface CodeExample {
  language: string;
  label: string;
  code: string;
}

export default function DeveloperPortal() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<APIEndpoint | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState('javascript');
  const [testingData, setTestingData] = useState<Record<string, any>>({});
  const [testResult, setTestResult] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');

  // Sample API endpoints
  const endpoints: APIEndpoint[] = [
    {
      path: '/api/products/search',
      method: 'GET',
      description: 'Search for products across multiple retailers',
      params: [
        { name: 'q', type: 'string', required: true, description: 'Search query', example: 'wireless headphones' },
        { name: 'category', type: 'string', required: false, description: 'Product category', example: 'electronics' },
        { name: 'min_price', type: 'number', required: false, description: 'Minimum price', example: 50 },
        { name: 'max_price', type: 'number', required: false, description: 'Maximum price', example: 500 },
        { name: 'limit', type: 'number', required: false, description: 'Results limit', example: 20 },
      ],
      response: {
        success: true,
        data: {
          products: [
            {
              id: 'prod_123',
              name: 'Sony WH-1000XM4 Wireless Headphones',
              price: 349.99,
              currency: 'USD',
              retailer: 'Amazon',
              rating: 4.5,
              reviews: 1250
            }
          ],
          pagination: { page: 1, total: 150 }
        }
      }
    },
    {
      path: '/api/alerts',
      method: 'POST',
      description: 'Create a new price alert',
      auth: true,
      body: {
        productId: 'prod_123',
        targetPrice: 299.99,
        currency: 'USD',
        notificationMethods: ['email', 'push']
      },
      response: {
        success: true,
        data: {
          id: 'alert_456',
          status: 'active',
          createdAt: '2024-01-15T10:30:00Z'
        }
      }
    },
    {
      path: '/api/currency',
      method: 'POST',
      description: 'Convert between currencies',
      body: {
        action: 'convert',
        amount: 100,
        from: 'USD',
        to: 'EUR'
      },
      response: {
        success: true,
        data: {
          from: 'USD',
          to: 'EUR',
          amount: 100,
          result: 85.23,
          rate: 0.8523,
          formatted: '€85.23'
        }
      }
    }
  ];

  // Generate code examples for different languages
  const generateCodeExample = (endpoint: APIEndpoint, language: string): string => {
    const baseUrl = 'https://api.shopvalue.com';
    const { path, method, params, body, auth } = endpoint;

    switch (language) {
      case 'javascript':
        if (method === 'GET') {
          const queryParams = params?.map(p => `${p.name}=${encodeURIComponent(p.example || '')}`).join('&');
          return `// Fetch products using JavaScript
const response = await fetch('${baseUrl}${path}?${queryParams || ''}', {
  method: '${method}',
  headers: {
    'Content-Type': 'application/json',${auth ? '\n    \'Authorization\': \'Bearer YOUR_JWT_TOKEN\',' : ''}
  }
});

const data = await response.json();
console.log(data);`;
        } else {
          return `// Create alert using JavaScript
const response = await fetch('${baseUrl}${path}', {
  method: '${method}',
  headers: {
    'Content-Type': 'application/json',${auth ? '\n    \'Authorization\': \'Bearer YOUR_JWT_TOKEN\',' : ''}
  },
  body: JSON.stringify(${JSON.stringify(body, null, 2)})
});

const data = await response.json();
console.log(data);`;
        }

      case 'python':
        if (method === 'GET') {
          const queryParams = params?.map(p => `    '${p.name}': '${p.example || ''}'`).join(',\n');
          return `# Fetch products using Python
import requests

params = {
${queryParams || ''}
}

headers = {
    'Content-Type': 'application/json',${auth ? '\n    \'Authorization\': \'Bearer YOUR_JWT_TOKEN\',' : ''}
}

response = requests.get('${baseUrl}${path}', params=params, headers=headers)
data = response.json()
print(data)`;
        } else {
          return `# Create alert using Python
import requests

data = ${JSON.stringify(body, null, 2).replace(/"/g, "'")}

headers = {
    'Content-Type': 'application/json',${auth ? '\n    \'Authorization\': \'Bearer YOUR_JWT_TOKEN\',' : ''}
}

response = requests.post('${baseUrl}${path}', json=data, headers=headers)
result = response.json()
print(result)`;
        }

      case 'curl':
        if (method === 'GET') {
          const queryParams = params?.map(p => `${p.name}=${p.example || ''}`).join('&');
          return `# Fetch products using cURL
curl -X ${method} \\
  "${baseUrl}${path}?${queryParams || ''}" \\
  -H "Content-Type: application/json"${auth ? ' \\\n  -H "Authorization: Bearer YOUR_JWT_TOKEN"' : ''}`;
        } else {
          return `# Create alert using cURL
curl -X ${method} \\
  "${baseUrl}${path}" \\
  -H "Content-Type: application/json"${auth ? ' \\\n  -H "Authorization: Bearer YOUR_JWT_TOKEN"' : ''} \\
  -d '${JSON.stringify(body)}'`;
        }

      case 'node':
        if (method === 'GET') {
          return `// Node.js with axios
const axios = require('axios');

const config = {
  method: '${method.toLowerCase()}',
  url: '${baseUrl}${path}',
  params: ${JSON.stringify(Object.fromEntries(params?.map(p => [p.name, p.example]) || []), null, 2)},
  headers: {
    'Content-Type': 'application/json',${auth ? '\n    \'Authorization\': \'Bearer YOUR_JWT_TOKEN\',' : ''}
  }
};

axios(config)
  .then(response => console.log(response.data))
  .catch(error => console.error(error));`;
        } else {
          return `// Node.js with axios
const axios = require('axios');

const config = {
  method: '${method.toLowerCase()}',
  url: '${baseUrl}${path}',
  headers: {
    'Content-Type': 'application/json',${auth ? '\n    \'Authorization\': \'Bearer YOUR_JWT_TOKEN\',' : ''}
  },
  data: ${JSON.stringify(body, null, 2)}
};

axios(config)
  .then(response => console.log(response.data))
  .catch(error => console.error(error));`;
        }

      default:
        return '// Select a language to see the code example';
    }
  };

  // Copy code to clipboard
  const copyToClipboard = async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(id);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  // Validate and sanitize API path
  const validateApiPath = (path: string): string => {
    // Check if path is a string
    if (typeof path !== 'string') {
      throw new Error('Invalid path: must be a string');
    }

    // Trim whitespace
    const trimmedPath = path.trim();

    // Check if path starts with /
    if (!trimmedPath.startsWith('/')) {
      throw new Error('Invalid path: must start with /');
    }

    // Check for protocol injection (://)
    if (trimmedPath.includes('://')) {
      throw new Error('Invalid path: protocol injection detected');
    }

    // Check for double slashes (except at the start)
    if (trimmedPath.includes('//')) {
      throw new Error('Invalid path: double slashes not allowed');
    }

    // Check for backslashes (Windows path separators)
    if (trimmedPath.includes('\\')) {
      throw new Error('Invalid path: backslashes not allowed');
    }

    // Check for control characters (0x00-0x1F, 0x7F)
    if (/[\x00-\x1F\x7F]/.test(trimmedPath)) {
      throw new Error('Invalid path: control characters not allowed');
    }

    // Check for spaces in path (should be percent-encoded)
    if (trimmedPath.includes(' ')) {
      throw new Error('Invalid path: spaces must be percent-encoded');
    }

    // Additional security: check for common injection patterns
    const dangerousPatterns = [
      '../',     // Directory traversal
      '..\\',    // Windows directory traversal
      '%2e%2e',  // URL-encoded ..
      '%2f',     // URL-encoded /
      '%5c',     // URL-encoded \
    ];

    const lowerPath = trimmedPath.toLowerCase();
    for (const pattern of dangerousPatterns) {
      if (lowerPath.includes(pattern)) {
        throw new Error(`Invalid path: dangerous pattern detected: ${pattern}`);
      }
    }

    // Validate path segments
    const segments = trimmedPath.split('/').filter(segment => segment.length > 0);
    for (const segment of segments) {
      // Check for empty segments (would create double slashes)
      if (segment.length === 0) {
        throw new Error('Invalid path: empty path segments not allowed');
      }
      
      // Check for relative path components
      if (segment === '.' || segment === '..') {
        throw new Error('Invalid path: relative path components not allowed');
      }
    }

    return trimmedPath;
  };

  // Test API endpoint
  const testEndpoint = async () => {
    if (!selectedEndpoint) return;

    setTestLoading(true);
    setTestResult(null);

    try {
      const { path, method, params, body, auth } = selectedEndpoint;
      
      // Validate and sanitize the path
      const validatedPath = validateApiPath(path);
      
      // Construct URL using URL constructor with a known base
      const baseUrl = 'https://api.shopvalue.com';
      let url: URL;
      
      try {
        url = new URL(validatedPath, baseUrl);
      } catch (error) {
        throw new Error('Invalid path: failed to construct valid URL');
      }
      
      // Add query parameters for GET requests
      if (method === 'GET' && params) {
        params.forEach(param => {
          const value = testingData[param.name];
          if (value) {
            url.searchParams.append(param.name, String(value));
          }
        });
      }

      const requestOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(auth && apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
        },
      };

      // Add body for POST requests
      if (method !== 'GET' && body) {
        requestOptions.body = JSON.stringify({ ...body, ...testingData });
      }

      const response = await fetch(url.toString(), requestOptions);
      const result = await response.json();
      
      setTestResult({
        status: response.status,
        statusText: response.statusText,
        data: result
      });
    } catch (error) {
      setTestResult({
        status: 500,
        statusText: 'Error',
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-xl flex items-center justify-center">
              <CodeBracketIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Developer Portal
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Integrate Shop Value's powerful APIs into your applications
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Quick Start
              </h2>
              
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-green-600 dark:text-green-400 text-sm font-medium">1</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">Get API Key</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Sign up and get your authentication token
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-blue-600 dark:text-blue-400 text-sm font-medium">2</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">Explore APIs</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Browse endpoints and try them out
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-purple-600 dark:text-purple-400 text-sm font-medium">3</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">Integrate</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Use our SDKs and code examples
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="font-medium text-gray-900 dark:text-white mb-3">
                  Featured Resources
                </h3>
                
                <div className="space-y-2">
                  <a
                    href="#endpoints"
                    className="flex items-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    <DocumentTextIcon className="w-4 h-4 mr-2" />
                    API Reference
                  </a>
                  <a
                    href="#authentication"
                    className="flex items-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    <ShieldCheckIcon className="w-4 h-4 mr-2" />
                    Authentication
                  </a>
                  <a
                    href="#testing"
                    className="flex items-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    <BeakerIcon className="w-4 h-4 mr-2" />
                    API Testing
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-8">
            {/* Overview */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Shop Value API Overview
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <BoltIcon className="w-8 h-8 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                  <h3 className="font-medium text-gray-900 dark:text-white">Fast & Reliable</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    99.9% uptime with sub-200ms response times
                  </p>
                </div>

                <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <ShieldCheckIcon className="w-8 h-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
                  <h3 className="font-medium text-gray-900 dark:text-white">Secure</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    OAuth 2.0 and API key authentication
                  </p>
                </div>

                <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <CursorArrowRaysIcon className="w-8 h-8 text-purple-600 dark:text-purple-400 mx-auto mb-2" />
                  <h3 className="font-medium text-gray-900 dark:text-white">Easy to Use</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    RESTful design with comprehensive docs
                  </p>
                </div>
              </div>

              <div className="prose dark:prose-invert max-w-none">
                <p className="text-gray-600 dark:text-gray-400">
                  The Shop Value API provides access to real-time product data, price tracking, 
                  currency conversion, and analytics. Build powerful shopping applications with 
                  our comprehensive set of endpoints.
                </p>
              </div>
            </div>

            {/* API Endpoints */}
            <div id="endpoints" className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                API Endpoints
              </h2>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Endpoint List */}
                <div className="space-y-4">
                  {endpoints.map((endpoint, index) => (
                    <motion.div
                      key={index}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedEndpoint === endpoint
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                      onClick={() => setSelectedEndpoint(endpoint)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          endpoint.method === 'GET' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        }`}>
                          {endpoint.method}
                        </span>
                        {endpoint.auth && (
                          <KeyIcon className="w-4 h-4 text-yellow-500" title="Requires authentication" />
                        )}
                      </div>
                      
                      <h3 className="font-medium text-gray-900 dark:text-white text-sm mb-1">
                        {endpoint.path}
                      </h3>
                      
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {endpoint.description}
                      </p>
                    </motion.div>
                  ))}
                </div>

                {/* Code Examples */}
                <div>
                  {selectedEndpoint ? (
                    <div className="space-y-4">
                      {/* Language Selector */}
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Language:
                        </span>
                        <select
                          value={selectedLanguage}
                          onChange={(e) => setSelectedLanguage(e.target.value)}
                          className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                        >
                          <option value="javascript">JavaScript</option>
                          <option value="python">Python</option>
                          <option value="curl">cURL</option>
                          <option value="node">Node.js</option>
                        </select>
                      </div>

                      {/* Code Block */}
                      <div className="relative">
                        <button
                          onClick={() => copyToClipboard(
                            generateCodeExample(selectedEndpoint, selectedLanguage),
                            `${selectedEndpoint.path}-${selectedLanguage}`
                          )}
                          className="absolute top-3 right-3 z-10 p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          {copiedCode === `${selectedEndpoint.path}-${selectedLanguage}` ? (
                            <CheckIcon className="w-4 h-4 text-green-400" />
                          ) : (
                            <ClipboardDocumentIcon className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                        
                        <SyntaxHighlighter
                          language={selectedLanguage === 'curl' ? 'bash' : selectedLanguage}
                          style={oneDark}
                          customStyle={{
                            borderRadius: '0.5rem',
                            fontSize: '0.875rem',
                            padding: '1rem',
                            paddingTop: '2.5rem'
                          }}
                        >
                          {generateCodeExample(selectedEndpoint, selectedLanguage)}
                        </SyntaxHighlighter>
                      </div>

                      {/* Response Example */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                          Response Example:
                        </h4>
                        <SyntaxHighlighter
                          language="json"
                          style={oneDark}
                          customStyle={{
                            borderRadius: '0.5rem',
                            fontSize: '0.875rem',
                            padding: '1rem'
                          }}
                        >
                          {JSON.stringify(selectedEndpoint.response, null, 2)}
                        </SyntaxHighlighter>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-64 bg-gray-50 dark:bg-gray-900 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                      <div className="text-center">
                        <CodeBracketIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 dark:text-gray-400">
                          Select an endpoint to see code examples
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* API Testing */}
            <div id="testing" className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                API Testing
              </h2>

              {selectedEndpoint ? (
                <div className="space-y-6">
                  {/* Authentication */}
                  {selectedEndpoint.auth && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        API Key / JWT Token
                      </label>
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Enter your API key or JWT token"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500"
                      />
                    </div>
                  )}

                  {/* Parameters */}
                  {selectedEndpoint.params && (
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                        Parameters
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {selectedEndpoint.params.map((param) => (
                          <div key={param.name}>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              {param.name}
                              {param.required && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            <input
                              type={param.type === 'number' ? 'number' : 'text'}
                              value={testingData[param.name] || ''}
                              onChange={(e) => setTestingData({
                                ...testingData,
                                [param.name]: e.target.value
                              })}
                              placeholder={param.example?.toString() || param.description}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500"
                            />
                            <p className="text-xs text-gray-500 mt-1">{param.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Test Button */}
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={testEndpoint}
                      disabled={testLoading}
                      className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {testLoading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      ) : (
                        <PlayIcon className="w-4 h-4 mr-2" />
                      )}
                      {testLoading ? 'Testing...' : 'Test API'}
                    </button>

                    {selectedEndpoint.auth && !apiKey && (
                      <div className="flex items-center text-yellow-600 dark:text-yellow-400">
                        <ExclamationTriangleIcon className="w-4 h-4 mr-1" />
                        <span className="text-sm">Authentication required</span>
                      </div>
                    )}
                  </div>

                  {/* Test Results */}
                  {testResult && (
                    <div className="mt-6">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        Response
                      </h3>
                      
                      <div className={`p-3 rounded-lg mb-3 ${
                        testResult.status < 400 
                          ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                          : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
                      }`}>
                        <span className="font-medium">
                          {testResult.status} {testResult.statusText}
                        </span>
                      </div>

                      <SyntaxHighlighter
                        language="json"
                        style={oneDark}
                        customStyle={{
                          borderRadius: '0.5rem',
                          fontSize: '0.875rem',
                          padding: '1rem'
                        }}
                      >
                        {JSON.stringify(testResult.data, null, 2)}
                      </SyntaxHighlighter>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 bg-gray-50 dark:bg-gray-900 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                  <div className="text-center">
                    <BeakerIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600 dark:text-gray-400">
                      Select an endpoint above to test it
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Authentication Guide */}
            <div id="authentication" className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                Authentication
              </h2>

              <div className="space-y-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-start">
                    <InformationCircleIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-3 flex-shrink-0" />
                    <div>
                      <h3 className="font-medium text-blue-900 dark:text-blue-200 mb-1">
                        Authentication Methods
                      </h3>
                      <p className="text-sm text-blue-800 dark:text-blue-300">
                        Shop Value API supports both JWT tokens from user authentication and API keys for server-to-server communication.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white mb-3">
                      JWT Token (User Auth)
                    </h3>
                    <SyntaxHighlighter
                      language="javascript"
                      style={oneDark}
                      customStyle={{
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        padding: '1rem'
                      }}
                    >
{`// Using JWT token from Clerk
const token = await getToken();

fetch('/api/alerts', {
  headers: {
    'Authorization': \`Bearer \${token}\`,
    'Content-Type': 'application/json'
  }
});`}
                    </SyntaxHighlighter>
                  </div>

                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white mb-3">
                      API Key (Server-to-Server)
                    </h3>
                    <SyntaxHighlighter
                      language="javascript"
                      style={oneDark}
                      customStyle={{
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        padding: '1rem'
                      }}
                    >
{`// Using API key
fetch('/api/products/search', {
  headers: {
    'X-API-Key': 'your-api-key',
    'Content-Type': 'application/json'
  }
});`}
                    </SyntaxHighlighter>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 