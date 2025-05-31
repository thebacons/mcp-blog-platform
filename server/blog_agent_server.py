from flask import Flask, request, jsonify
import os

# === Replace this with your Gemini logic ===
def write_blog(notes):
    # Example: Replace with your real Gemini code
    # For now, just echo the notes as a "blog post"
    return f"<h2>Blog Post</h2><p>{notes}</p>"
# ===========================================

app = Flask(__name__)

@app.route('/callback', methods=['POST'])
def handle_message():
    data = request.json
    notes = data.get('payload', {}).get('text', '')
    blog_post = write_blog(notes)
    return jsonify({'blog_post': blog_post})

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
