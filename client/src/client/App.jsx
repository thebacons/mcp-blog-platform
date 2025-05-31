import React, { useState } from 'react';
import api from './api.js';

const defaultRegisterPayload = {
  agentId: 'test-agent',
  capabilities: [
    { name: 'test-capability', description: 'A test capability.' }
  ],
  endpoint: 'http://localhost:5000/callback'
};

const defaultMessagePayload = {
  messageId: 'test-message-uuid',
  capability: 'test-capability',
  payload: { text: 'Hello agent!' }
};

export default function App() {
  // Blog writing agent state
  const [blogNote, setBlogNote] = useState('My AI project is awesome!');
  const [blogResult, setBlogResult] = useState('');
  

  const [pingResult, setPingResult] = useState(null);
  const [registerPayload, setRegisterPayload] = useState(JSON.stringify(defaultRegisterPayload, null, 2));
  const [registerResult, setRegisterResult] = useState(null);
  // Use default API keys for all requests for developer convenience
const REGISTER_API_KEY = 'orchestrator-register-key';
const MESSAGE_API_KEY = 'orchestrator-message-key';
  const [messagePayload, setMessagePayload] = useState(JSON.stringify(defaultMessagePayload, null, 2));
  const [messageResult, setMessageResult] = useState(null);
  

  const handlePing = async () => {
    setPingResult('Loading...');
    const res = await api.ping();
    setPingResult(JSON.stringify(res, null, 2));
  };

  const handleRegister = async () => {
    setRegisterResult('Loading...');
    try {
      const res = await api.register(JSON.parse(registerPayload), REGISTER_API_KEY);
      setRegisterResult(JSON.stringify(res, null, 2));
    } catch (e) {
      setRegisterResult(e.message);
    }
  };

  const handleMessage = async () => {
    setMessageResult('Loading...');
    try {
      const res = await api.message(JSON.parse(messagePayload), MESSAGE_API_KEY);
      setMessageResult(JSON.stringify(res, null, 2));
    } catch (e) {
      setMessageResult(e.message);
    }
  };

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 700, margin: '0 auto', padding: 24 }}>
      <h1>MCP Orchestrator API Tester</h1>
      <section style={{ marginBottom: 32 }}>
        <h2>Health Check</h2>
        <button onClick={handlePing}>Ping Orchestrator</button>
        <pre style={{ background: '#f6f6f6', padding: 12 }}>{pingResult}</pre>
      </section>
      <section style={{ marginBottom: 32 }}>
        <h2>Register Agent</h2>

        <textarea rows={7} style={{ width: '100%' }} value={registerPayload} onChange={e => setRegisterPayload(e.target.value)} />
        <br/>
        <button onClick={handleRegister}>POST /register</button>
        <pre style={{ background: '#f6f6f6', padding: 12 }}>{registerResult}</pre>
      </section>
      <section>
        <h2>Send Message</h2>

        <textarea rows={7} style={{ width: '100%' }} value={messagePayload} onChange={e => setMessagePayload(e.target.value)} />
        <br/>
        <button onClick={handleMessage}>POST /message</button>
        <pre style={{ background: '#f6f6f6', padding: 12 }}>{messageResult}</pre>
      </section>
      <section>
        <h2>Blog Writing Agent</h2>

        <textarea rows={3} style={{ width: '100%' }} value={blogNote} onChange={e => setBlogNote(e.target.value)} placeholder="Enter notes for blog post..." />
        <br/>
        <button onClick={async () => {
          setBlogResult('Loading...');
          try {
            const res = await api.message({
              messageId: 'blog-message-' + Date.now(),
              capability: 'blog-writing',
              payload: { text: blogNote }
            }, MESSAGE_API_KEY);
            setBlogResult(res.blog_post || JSON.stringify(res, null, 2));
          } catch (e) {
            setBlogResult(e.message);
          }
        }}>Send to Blog Agent</button>
        <pre style={{ background: '#f6f6f6', padding: 12 }}>{blogResult}</pre>
      </section>
    </div>
  );
}
