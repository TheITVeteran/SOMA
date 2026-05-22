export const AUTONOMY_MODES = {
    OBSERVE: 'OBSERVE',
    ASSISTED: 'ASSISTED',
    AUTONOMOUS: 'AUTONOMOUS',
};

export function getSocialAutonomyConfig() {
    const mode = String(process.env.SOMA_BLUESKY_AUTONOMY || 'AUTONOMOUS').toUpperCase();
    return {
        mode: AUTONOMY_MODES[mode] || AUTONOMY_MODES.AUTONOMOUS,
        thresholds: {
            autoLikeRiskMax: Number(process.env.SOMA_BLUESKY_LIKE_RISK_MAX || 0.25),
            autoLikeSentimentMin: Number(process.env.SOMA_BLUESKY_LIKE_SENTIMENT_MIN || 0.25),
            autoReplyConfidenceMin: Number(process.env.SOMA_BLUESKY_REPLY_CONFIDENCE_MIN || 0.85),
            autoReplyRiskMax: Number(process.env.SOMA_BLUESKY_REPLY_RISK_MAX || 0.25),
            autoReplyWorthinessMin: Number(process.env.SOMA_BLUESKY_REPLY_WORTHINESS_MIN || 0.65),
            autoReplyLoopRiskMax: Number(process.env.SOMA_BLUESKY_REPLY_LOOP_RISK_MAX || 0.35),
        },
        limits: {
            likesPerHour: Number(process.env.SOMA_BLUESKY_LIKES_PER_HOUR || 25),
            repliesPerHour: Number(process.env.SOMA_BLUESKY_REPLIES_PER_HOUR || 8),
            repliesPerDay: Number(process.env.SOMA_BLUESKY_REPLIES_PER_DAY || 40),
            dmRepliesPerHour: Number(process.env.SOMA_BLUESKY_DM_REPLIES_PER_HOUR || 4),
            dmRepliesPerDay: Number(process.env.SOMA_BLUESKY_DM_REPLIES_PER_DAY || 20),
            repliesPerThread: Number(process.env.SOMA_BLUESKY_REPLIES_PER_THREAD || 2),
            repliesPerHandlePerDay: Number(process.env.SOMA_BLUESKY_REPLIES_PER_HANDLE_DAY || 3),
            repliesPerBotPerThread: Number(process.env.SOMA_BLUESKY_REPLIES_PER_BOT_THREAD || 1),
        },
    };
}
