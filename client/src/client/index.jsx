import React from 'react';
import { createRoot } from 'react-dom/client';
import EnhancedBlogApp from './EnhancedBlogApp.jsx';

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<EnhancedBlogApp />);
