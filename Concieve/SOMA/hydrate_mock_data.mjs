
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_FILE = path.join(__dirname, 'frontend/apps/command-bridge/components/Forecaster/services/mockData.js');

const SPORT_MAPPING = {
    basketball: { league: 'nba', enum: 'Sport.NBA' },
    football: { league: 'nfl', enum: 'Sport.NFL' },
    soccer: { league: 'eng.1', enum: 'Sport.EPL' }
};

async function fetchSportsData() {
    let allGames = [];
    
    for (const [sport, config] of Object.entries(SPORT_MAPPING)) {
        const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${config.league}/scoreboard`;
        console.log(`Fetching ${url}...`);
        try {
            const res = await fetch(url);
            if (!res.ok) continue;
            const data = await res.json();
            
            const mapped = (data.events || []).map(evt => mapEvent(evt, config.enum));
            allGames = allGames.concat(mapped);
        } catch (e) {
            console.error(`Failed to fetch ${sport}:`, e.message);
        }
    }
    
    return allGames;
}

function mapEvent(evt, sportEnum) {
    const comp = evt.competitions[0];
    const home = comp.competitors.find(c => c.homeAway === 'home');
    const away = comp.competitors.find(c => c.homeAway === 'away');
    
    let status = 'GameStatus.SCHEDULED';
    if (evt.status.type.state === 'in') status = 'GameStatus.LIVE';
    if (evt.status.type.state === 'post') status = 'GameStatus.FINISHED';

    const formatTeam = (t) => ({
        id: t.team.id,
        name: t.team.displayName,
        shortName: t.team.abbreviation,
        record: t.records?.[0]?.summary || '0-0',
        logoColor: `#${t.team.color || '000000'}`
    });

    return {
        id: evt.id,
        sport: sportEnum, 
        status: status,
        homeTeam: formatTeam(home),
        awayTeam: formatTeam(away),
        homeScore: parseInt(home.score || 0),
        awayScore: parseInt(away.score || 0),
        quarter: evt.status.period ? `Q${evt.status.period}` : '', 
        clock: evt.status.displayClock || '',
        startTime: evt.date,
        marketOdds: {
            provider: 'Consensus',
            homeMoneyline: -110,
            awayMoneyline: -110,
            spread: comp.odds?.[0]?.details || 'OFF',
            total: comp.odds?.[0]?.overUnder || 0,
            lastUpdated: 'ISODATE_PLACEHOLDER'
        },
        events: [],
        homePlayerStats: [],
        awayPlayerStats: [],
        props: []
    };
}

async function writeMockFile(games) {
    // Generate the JS file content
    const gamesString = JSON.stringify(games, null, 4)
        // Post-processing to fix Enums and Dates
        .replace(/"Sport\.(NBA|NFL|EPL)"/g, 'Sport.$1')
        .replace(/"GameStatus\.(LIVE|SCHEDULED|FINISHED)"/g, 'GameStatus.$1')
        .replace(/"ISODATE_PLACEHOLDER"/g, 'new Date().toISOString()');

    const content = `import { GameStatus, Sport } from '../types.js';

export const generateMockHistory = () => {
    const history = [];
    let value = 50;
    for (let i = 0; i < 30; i++) {
        const change = (Math.random() - 0.5) * 10;
        value += change;
        value = Math.max(10, Math.min(90, value));
        history.push({ time: i, value });
    }
    return history;
};

// Auto-Generated Real Data Snapshot (${new Date().toISOString()})
export const INITIAL_GAMES = ${gamesString};
`;

    fs.writeFileSync(TARGET_FILE, content, 'utf8');
    console.log(`Updated ${TARGET_FILE} with ${games.length} real games.`);
}

// Run
fetchSportsData().then(games => {
    if (games.length > 0) {
        writeMockFile(games);
    } else {
        console.error("No games fetched, aborting overwrite.");
    }
});
