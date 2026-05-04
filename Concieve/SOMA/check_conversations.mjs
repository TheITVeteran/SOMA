import Database from 'better-sqlite3';

const db = new Database('./SOMA/conversations.db');

console.log('\n=== SOMA CONVERSATION HISTORY ===\n');

const sessionCount = db.prepare('SELECT COUNT(*) as count FROM sessions').get();
console.log(`📊 Total sessions: ${sessionCount.count}`);

const messageCount = db.prepare('SELECT COUNT(*) as count FROM messages').get();
console.log(`💬 Total messages: ${messageCount.count}`);

const recentSessions = db.prepare(`
  SELECT id, user_id, started_at, message_count, metadata
  FROM sessions
  ORDER BY started_at DESC
  LIMIT 5
`).all();

console.log('\n📝 Recent Sessions:');
recentSessions.forEach(session => {
  const date = new Date(session.started_at);
  console.log(`  - ${session.id.substring(0, 8)}... | ${date.toLocaleString()} | ${session.message_count} messages`);
});

// Get messages from most recent session
if (recentSessions.length > 0) {
  const recentMessages = db.prepare(`
    SELECT role, content, timestamp
    FROM messages
    WHERE session_id = ?
    ORDER BY timestamp DESC
    LIMIT 10
  `).all(recentSessions[0].id);

  console.log(`\n💭 Last ${recentMessages.length} messages from most recent session:`);
  recentMessages.reverse().forEach((msg, i) => {
    const snippet = msg.content.substring(0, 80).replace(/\n/g, ' ');
    console.log(`  ${i + 1}. [${msg.role}] ${snippet}${msg.content.length > 80 ? '...' : ''}`);
  });
}

db.close();
