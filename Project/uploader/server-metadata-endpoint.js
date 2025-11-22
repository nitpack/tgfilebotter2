// ADD THIS ENDPOINT TO server.js (after the /api/bot-status endpoint)
// This endpoint is needed for the Update Mode in the Windows uploader

// Bot metadata endpoint (for update mode in uploader)
app.get('/api/bot-metadata/:botToken', async (req, res) => {
  try {
    const botToken = security.sanitizeInput(req.params.botToken);
    const bot = storage.getBotByToken(botToken);

    if (!bot) {
      return res.status(404).json({
        success: false,
        error: 'Bot not found'
      });
    }

    // Return the full metadata for comparison
    return res.json({
      success: true,
      botId: bot.id,
      status: bot.status,
      metadata: bot.metadata,
      lastUpdate: bot.lastUpdate,
      createdAt: bot.createdAt
    });

  } catch (error) {
    console.error('Metadata fetch error:', error);
    return res.status(500).json({
      success: false,
      error: 'Error fetching bot metadata'
    });
  }
});

// ============================================================
// INSTRUCTIONS:
// ============================================================
// 
// Add this endpoint to your backend/server.js file.
// 
// Place it after the existing /api/bot-status/:botToken endpoint
// and before the admin endpoints section.
// 
// This endpoint allows the Windows uploader to fetch existing
// bot metadata for comparison in "Update Mode".
// 
// The uploader will:
// 1. Call this endpoint with the bot token
// 2. Compare server metadata with local folder structure
// 3. Identify added/removed/modified/unchanged files
// 4. Only upload changed files (saving time and bandwidth)
// ============================================================
