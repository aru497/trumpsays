#!/bin/bash
# TrumpSays – Free Setup
# Run this once, then double-click "launch.command" to start

set -e
echo "🇺🇸 TrumpSays Free Setup"
echo "========================"

echo ""
echo "1. Installing Python packages..."
pip3 install feedparser yfinance spacy requests --break-system-packages 2>/dev/null || \
pip3 install feedparser yfinance spacy requests

echo ""
echo "2. Downloading spaCy language model (English NER)..."
python3 -m spacy download en_core_web_sm

echo ""
echo "3. Creating launch shortcut..."
DIR="$(cd "$(dirname "$0")" && pwd)"
cat > "$DIR/launch.command" << LAUNCH
#!/bin/bash
cd "$DIR"
python3 free_server.py
LAUNCH
chmod +x "$DIR/launch.command"

echo ""
echo "✅ Done! To start TrumpSays:"
echo "   Double-click  →  launch.command"
echo "   Or run        →  python3 free_server.py"
echo ""
echo "   Browser opens to http://localhost:8080"
