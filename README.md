# Figma Translation Agent

This project provides an AI-powered multi-agent system for Figma plugins, featuring intelligent translation, content generation, accessibility analysis, and automated design workflows.

## Project Structure

```
figma_translation_agent/
  backend/
    app/
      main.py
      agents/
      api/
      orchestrator/
      services/
      translations/
      ...
    pyproject.toml
  plugin/
    code.ts                    # Main plugin logic
    ui.html                    # Advanced UI with dynamic resizing
    manifest.json              # Plugin configuration
    agents/
      chatAgent.ts             # LLM-powered backup agent
      contentFillerAgent.ts    # Smart content generation
      contrastAgent.ts         # LLM-enhanced accessibility checker
      resizeAgent.ts           # Intelligent frame resizing
      translateAgent.ts        # Multi-language translation
    orchestrator/
      agentOrchestrator.ts     # Agent coordination system
    shared/
      llmClient.ts             # LLM integration
    utils/
      types.ts                 # TypeScript definitions
    build.js                   # Build system with env support
```

## 🚀 Frontend Features

### **🤖 Multi-Agent System**

- **Chat Agent**: Intelligent backup for general queries and guidance
- **Content Filler**: Smart text generation with input field detection
- **Contrast Checker**: LLM-enhanced WCAG accessibility analysis
- **Resize Agent**: Frame creation with content preservation and scaling
- **Translation Agent**: Multi-language text translation

### **UI Architecture**

- **Agent Output Field**: Rich HTML display for detailed LLM reports and analysis
- **Process Log**: Clean, focused logging with contrast agent exclusion
- **Agent Info Modal**: Comprehensive agent descriptions with status badges

### **Intelligent Agent Orchestration**

- **Context Chaining**: Seamless data flow between agents
- **Smart Task Planning**: LLM analyzes user intent and coordinates multiple agents
- **Content Preservation**: Maintains design integrity across agent operations
- **Error Handling**: Robust fallback systems and comprehensive error reporting

### **🔍 Enhanced Accessibility**

- **LLM-Powered Contrast Analysis**: Professional reports with specific recommendations
- **WCAG Compliance**: Accurate AA/AAA assessment with actionable fixes
- **Color Recommendations**: Intelligent suggestions for accessibility improvements

## 🚀 Getting Started

### Prerequisites

- **Python 3.8+** (for backend services)
- **Node.js 16+** (for plugin development)
- **Figma Desktop App** (for plugin testing and development)
- **API Keys**: OpenAI/LLM provider for AI features

### 🔧 Environment Setup

1. **Create environment file** in the plugin directory:

   ```bash
   cd plugin
   ```

2. **Configure API keys** in `.env`:
   ```env
   GROQ_KEY=your_openai_key_here
   # Add other LLM provider keys as needed
   ```

### 🖥️ Backend Setup

1. Navigate to the backend directory:

   ```bash
   cd figma_translation_agent/backend
   ```

2. Install Python dependencies:

   ```bash
   poetry install
   ```

3. Run the backend server:
   ```bash
   python app/main.py
   ```

### 🔌 Plugin Setup

1. **Navigate to plugin directory**:

   ```bash
   cd plugin
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Build the plugin**:

   ```bash
   node build.js
   ```

   _The build system automatically loads environment variables and compiles TypeScript_

4. **Development workflow**:
   - Edit TypeScript files in `plugin/` directory
   - Run `node build.js` after changes
   - Refresh plugin in Figma to see updates

### 📱 Loading Plugin in Figma:

1. **Open Figma Desktop**
2. **Navigate to**: `Plugins → Development → Import plugin from manifest`
3. **Select**: The `manifest.json` file from the plugin directory
4. **Launch**: Find "Translation Agent" in your plugins menu

## 🛠️ Development Guide

### **Plugin Architecture**

The plugin follows a sophisticated multi-agent orchestration pattern:

```typescript
// Agent Orchestration Flow
User Input → Agent Orchestrator → Specific Agent → LLM Analysis → Response
```

### **Adding New Agents**

1. **Create agent file** in `plugin/agents/`:

   ```typescript
   export async function runYourAgent(
     context: PluginContext,
     userMessage: string
   ): Promise<AgentResponse> {
     // Agent implementation
   }
   ```

2. **Register in orchestrator** (`agentOrchestrator.ts`):

   ```typescript
   const agentMap = {
     // ... existing agents
     "your-agent": runYourAgent,
   };
   ```

3. **Update UI** (`ui.html`) with agent info and descriptions

### **Environment Variables**

Create `.env` file in plugin directory:

```env
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=optional_claude_key
GROQ_API_KEY=optional_groq_key
```

### **Build System**

The build process (`build.js`):

- Loads environment variables securely
- Compiles TypeScript with proper error handling
- Bundles code for Figma plugin runtime

## 🎯 Usage Examples

### **Chat Agent (Backup)**

- Select any frame or element
- Ask general questions: _"How can I improve this design?"_
- Get AI-powered guidance and suggestions

### **Content Filler**

- Select frames with text elements
- Request: _"Fill this form with sample user data"_
- Watch intelligent content generation with input field detection

### **Contrast Checker**

- Select elements with text/background
- Get detailed WCAG accessibility reports
- Receive specific color recommendations

### **Smart Resize**

- Select frames to resize
- Specify dimensions or scaling factors
- Content automatically preserved and repositioned

## 📚 Translation Files

- **Location**: `backend/app/translations/`
- **Format**: JSON files (e.g., `da.json`, `fi.json`)
- **Processing**: Use provided scripts to clean and validate JSON

## 🤝 Contributing

1. **Fork the repository**
2. **Create feature branch**:
   ```bash
   git checkout -b feat/your-amazing-feature
   ```
3. **Make your changes** following the established patterns
4. **Test thoroughly** with the Figma plugin
5. **Commit with clear messages**:
   ```bash
   git add .
   git commit -m "feat: add amazing new feature"
   git push origin feat/your-amazing-feature
   ```
6. **Open a pull request** with detailed description

### **Code Standards**

- **TypeScript**: Strict typing with proper interfaces
- **Error Handling**: Comprehensive try-catch with user feedback
- **Agent Pattern**: Follow established orchestrator integration
- **UI Consistency**: Maintain glassmorphism design language

## Security

- **API Keys**: Always use environment variables (`.env`)
- **Git Ignore**: Never commit sensitive credentials
- **Environment Separation**: Use different keys for development/production

## Troubleshooting

### **Common Issues**

**Plugin Not Loading:**

```bash
# Rebuild and refresh
node build.js
# Refresh plugin in Figma
```

**API Errors:**

```bash
# Check environment variables
cat .env
# Verify API key validity
```

**Agent Not Responding:**

```bash
# Check console for TypeScript errors
# Verify agent registration in orchestrator
```

## License

MIT License - see LICENSE file for details
