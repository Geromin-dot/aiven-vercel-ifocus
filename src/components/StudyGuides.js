export function TaskEffortGuide() {
  return <details className="study-input-guide">
    <summary>Choosing task effort and ordering</summary>
    <p><strong>Low</strong> — a short, familiar task. <strong>Medium</strong> — several steps or moderate concentration. <strong>High</strong> — complex work or sustained concentration. Choose the effort that fits your own task.</p>
    <p>If every task is High, effort alone cannot distinguish them. The coach keeps your current order unless you request a different starting task. Move a task first or name it in your reflection.</p>
  </details>;
}

export function FlashcardUploadGuide() {
  return <details className="study-input-guide">
    <summary>What can I upload or paste?</summary>
    <p>Upload an existing <strong>PDF up to 3 MB</strong>, such as a module, lecture slides, or notes. Export PowerPoint slides as PDF first. You can also paste up to <strong>35,000 characters</strong> of study text.</p>
    <p>Use readable pages with enough context. Clear headings, definitions, and complete explanations help. Scans, small text, and unclear diagrams may need correction or a clearer copy. Split long notes into sections.</p>
    <p>Choose a card count or Auto, then generate. Each draft card includes a question or term, an answer, a memory keyword, and a category. Review the cards against your source before saving.</p>
    <div className="upload-sample">
      <strong>Example study notes</strong>
      <pre>{`COMPUTER BASICS

CPU: The central processing unit executes program instructions.
RAM: Random access memory temporarily holds data used by running programs. Its contents are lost when power is turned off.
Storage: An SSD stores files and programs even when power is turned off.

Examples of input devices:
1. Keyboard
2. Mouse
3. Microphone`}</pre>
      <p><strong>Example card</strong><br />Front: What does RAM do?<br />Back: It temporarily holds data used by running programs.<br />Memory keyword: Temporary working memory</p>
      <p>This is an example, not a required template. You can use your existing readable module or lecture notes.</p>
      <div className="upload-sample-links">
        <a href="/samples/ifocus-study-notes.pdf" download>Download sample PDF</a>
        <a href="/samples/ifocus-study-notes.txt" download>Download sample text</a>
      </div>
    </div>
  </details>;
}
