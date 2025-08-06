# Figma Translation Agent

This project provides an AI-powered translation agent for Figma plugins, supporting multi-language translation and knowledge base integration.

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
  frontend/
    src/app/components/
  plugin/
    code.ts
    manifest.json
```

## Features

- AI agent for translation tasks
- Figma plugin integration
- Multi-language support (e.g., Danish, Finnish)
- Knowledge base from translation files
- Python backend (Crew AI)
- Angular frontend

## Getting Started

### Prerequisites

- Python 3.8+
- Node.js (for plugin/frontend)
- Figma desktop app (for plugin testing)

### Backend Setup

1. Navigate to the backend directory:
   ```
   cd figma_translation_agent/backend
   ```
2. Install Python dependencies:
   ```
   poetry install
   ```
3. Run the backend:
   ```
   python app/main.py
   ```

### Frontend/Plugin Setup

1. Navigate to the plugin or frontend directory:
   ```
   cd figma_translation_agent/plugin
   # or
   cd figma_translation_agent/frontend
   ```
2. Install Node.js dependencies:
   ```
   npm install
   ```
3. Build and run as needed:
   ```
   npm run build
   # or
   npm start
   ```

### Translation Files

- Place translation files (e.g., `da.json`, `fi.json`) in `backend/app/translations/`.
- Use provided scripts to clean and convert translation files to valid JSON.

## Contributing

1. Create a new branch for your feature:
   ```
   git checkout -b feat/your-feature
   ```
2. Commit and push your changes:
   ```
   git add .
   git commit -m "Add feature"
   git push origin feat/your-feature
   ```
3. Open a pull request for review.

## License

MIT

## Contact

For questions or support, contact the repository owner or open an issue on GitHub.
