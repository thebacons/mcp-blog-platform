# MCP Orchestrator

This service acts as the orchestrator for Model Content Protocol (MCP) agents.

## Features

- Agent registration with capability descriptors
- JSON Schema validation for all messages and registrations
- Secure routing of messages to agents by capability
- Winston-based logging
- API key security (header-based)
- Docker and Codespaces ready

## Setup

1. Copy `.env.example` to `.env` and set your secrets/keys.
2. Install dependencies:  
   ```bash
   npm install
   ```

# **Project: AI-Powered Note-to-Blog & Task App with Google Integration**

---

## **1. Project Overview**

**Description:**
An AI-driven assistant (chatbot interface) that enables users to:

* Take rough notes (voice, text, or chat) for input to a blog or task, actions as short phrase
*
* Integrate and comnbined with Google fotos to fetch and suggest fotos to be included into the blog or  based on content and geolocation  Using a command, Automatically generate the rough text  entries from those notes using key phrases, context, and relevant images into structured texts. 
* Extract actionable tasks from conversations or notes, pushing them to Google Tasks
* Visualize tasks as mindmaps and Kanban boards for easy overview and planning

**Target Users:**

* Bloggers, knowledge workers, project managers, digital journaling enthusiasts, and anyone wanting to quickly turn notes into rich blog posts and actionable plans.

---

## **2. Core Features**

### **A. AI Note-taking Chatbot**

* Conversational interface for notes (voice or text)
* Auto-tagging of key phrases, sentiment, and topics
* Option to attach or suggest Google Photos based on content

### **B. Blog Post Generation**

* One-click or automated blog post creation from notes
* Incorporation of selected Google Photos (with geo-tags, date, etc.)
* Location mapping (embed map or show context from photo metadata)
* Export to Markdown, WordPress, Notion, or HTML

### **C. Google Photos Integration**

* Connect Google Photos account
* Retrieve and suggest relevant images (using AI + note context)
* Pull geolocation and time data for contextual enhancements

### **D. Task Extraction & Google Tasks Integration**

* AI identifies action items, deadlines, and TODOs in notes/conversations
* Pushes tasks to Google Tasks via API
* Organize tasks by project, category, or context

### **E. Visual Task Planning (Mindmap & Kanban)**

* Tasks visualized as interactive mindmaps
* Alternative Kanban board view
* Sync status changes back to Google Tasks

### **F. User & Data Management**

* Google authentication (OAuth 2.0)
* Secure data storage (cloud or local, user choice)
* Basic settings: privacy, data export, integrations

---

## **3. Technical Stack Suggestions**

### **Frontend**

* **React** (Web) or **React Native** (Mobile)
* **Material UI** or **Tailwind CSS** for modern look
* Mindmap library: **react-mindmap**, **GoJS**, or **d3.js**
* Kanban: **react-beautiful-dnd** or **Trello API**

### **Backend**

* **Node.js** with **Express.js**
* AI/NLP layer: **OpenAI API** (GPT-4o/4.1) or **Anthropic Claude** for note parsing, summarization, and key phrase extraction
* **Google APIs**: Photos, Tasks, Maps, Auth (OAuth 2.0)
* Storage: **MongoDB Atlas** (for scalability), or Firebase

### **Integrations**

* **Google Photos API**: Fetch images, filter by location/date
* **Google Tasks API**: Create, update, sync tasks
* **Google Maps API**: Geolocation mapping for blogs
* Optional: **Notion API**, **WordPress API** for blog export

### **Hosting & DevOps**

* **Vercel** or **Netlify** (Frontend)
* **Render.com**, **Heroku**, or **GCP/AWS** (Backend)
* **Docker** for containerization
* **GitHub Actions** for CI/CD

---

## **4. Technical Specification Outline**

### **A. User Stories / Workflow**

1. **As a user, I can...**

   * Open a chatbot and dictate or type notes
   * See key phrases and AI suggestions highlighted in real-time
   * Ask for a blog draft with embedded relevant photos and location
   * Approve, edit, or publish blog content
   * Review and approve AI-extracted tasks, which are pushed to Google Tasks
   * View and organize tasks visually as mindmaps or Kanban boards
   * Sync all data securely and manage privacy/integrations

### **B. Key API Endpoints**

* `/api/notes`: Create, retrieve, update notes
* `/api/blogs`: Generate blog from notes, list, update, export
* `/api/photos`: Connect Google Photos, suggest images, get metadata
* `/api/tasks`: Extract, create, sync tasks with Google
* `/api/mindmap`: Visualize and interact with tasks/notes
* `/api/auth`: Google OAuth login

### **C. Data Models**

* **User:** { id, googleAuth, settings, ... }
* **Note:** { id, userId, text, createdAt, keyPhrases, photoRefs }
* **BlogPost:** { id, userId, content, photos, location, publishedAt }
* **Task:** { id, userId, content, status, googleTaskId, ... }
* **Photo:** { id, url, metadata, location, timestamp, ... }

---

## **5. Next Steps**

1. **Requirements Refinement:**
   Confirm/adjust features and workflow to best match your vision.

2. **Wireframes & UI Mockups:**
   Sketch the chatbot, blog, and mindmap/task views.

3. **Proof of Concept:**

   * Set up a basic React front-end
   * Implement Google OAuth
   * Try Google Photos & Tasks API integration
   * Test AI note-to-blog and task extraction (using OpenAI API)

4. **Iterate:**
   Build out additional features, refine UI, and connect all modules.

---

## **Would you like to begin with:**

* Detailed user stories?
* A wireframe/mockup?
* A technical proof of concept?
* Or a step-by-step feature implementation plan?cd orchestrator-client
