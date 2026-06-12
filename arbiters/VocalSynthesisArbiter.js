import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { BaseArbiter } = require('../core/BaseArbiter.cjs');
const messageBroker = require('../core/MessageBroker.cjs');
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * VocalSynthesisArbiter â€” PROJECT SIREN
 * v0.5 â€” Human-Identical Voice Engine with Deep Diagnostics
 */
export class VocalSynthesisArbiter extends BaseArbiter {
  static role = 'vocal-synthesis';
  static capabilities = [
    'generate-speech',
    'voice-cloning',
    'emotional-prosody',
    'real-time-streaming',
    'local-playback'
  ];

  constructor(id, config = {}) {
    super(id, config);
    this.name = 'VocalSynthesisArbiter';
    this.config = {
      primaryEngine: config.primaryEngine || 'fish-speech', 
      fishSpeechUrl: config.fishSpeechUrl || 'http://localhost:8081',
      elevenLabsKey: process.env.ELEVENLABS_API_KEY,
      voiceId: process.env.ELEVENLABS_VOICE_ID || 'nf4MCGNSdM0hxM95ZBQR',
      playLocal: config.playLocal !== false, 
      ...config
    };
  }

  async onInitialize() {
    console.log('[Siren] ðŸ§œâ€â™€ï¸ Initializing Human-Identical Voice Engine...');
    
    const cacheDir = path.join(process.cwd(), 'data', 'audio', 'cache');
    await fs.mkdir(cacheDir, { recursive: true });

    this.currentChemistry = { dopamine: 0.5, cortisol: 0.1, oxytocin: 0.5, serotonin: 0.5 };
    this.currentWeather = 'CLEAR';

    
    

    messageBroker.subscribe('limbic_update', (msg) => {
      this.currentChemistry = msg.payload.chemistry;
      this.currentWeather = msg.payload.weather;
    });

    messageBroker.subscribe('vocal_synthesis_requested', async (msg) => {
      try {
        await this.handleSynthesis(msg.payload);
      } catch (err) {
        console.error('[Siren] Async synthesis error:', err.message);
      }
    });

    console.log('[Siren] âœ… Vocal Synthesis online.');
  }

  async handleSynthesis(payload) {
    const { text, requestId } = payload;
    if (!text) return { success: false, error: 'No text provided' };

    const emotion = payload.emotion || this._getEmotionFromWeather();
    console.log(`[Siren] ðŸ—£ï¸ Synthesizing (${this.currentWeather}/${emotion}): "${text.slice(0, 50)}..."`);

    let result = { success: false };
    
    // 1. Attempt FishSpeech (Local)
    if (this.config.primaryEngine === 'fish-speech') {
      result = await this._synthesizeFish(text, emotion);
      if (!result.success) console.warn(`[Siren] âš ï¸ Local engine failed: ${result.error}`);
    } 
    
    // 2. Fallback to ElevenLabs (Cloud)
    if (!result.success) {
      console.log('[Siren] â˜ï¸ Falling back to ElevenLabs...');
      result = await this._synthesizeEleven(text, emotion);
    }

    // 3. Final Fallback (Log only)
    if (!result.success) {
      console.error(`[Siren] âŒ All synthesis engines failed: ${result.error}`);
      return result;
    }

    // 4. Play Locally
    if (result.success && this.config.playLocal) {
      this._playLocal(result.audioPath);
    }

    if (requestId) {
      await messageBroker.publish('vocal_synthesis_ready', {
        requestId,
        audioPath: result.audioPath,
        success: result.success
      });
    }

    return result;
  }

  _playLocal(filePath) {
    console.log(`[Siren] ðŸ”ˆ Playing: ${path.basename(filePath)}`);
    
    const psCommand = `
      Add-Type -AssemblyName PresentationCore;
      $player = New-Object System.Windows.Media.MediaPlayer;
      $player.Open('${filePath}');
      $player.Play();
      $duration = 0;
      while ($player.NaturalDuration.HasTimeSpan -eq $false -and $duration -lt 20) {
          Start-Sleep -Milliseconds 100;
          $duration++;
      }
      if ($player.NaturalDuration.HasTimeSpan) {
          Start-Sleep -Seconds ($player.NaturalDuration.TimeSpan.TotalSeconds + 1);
      } else {
          Start-Sleep -Seconds 5;
      }
      $player.Close();
    `.replace(/\n/g, ' ');

    exec(`powershell -NoProfile -Command "${psCommand}"`, (err) => {
      if (err) console.warn('[Siren] Local playback failed:', err.message);
    });
  }

  _getEmotionFromWeather() {
    const w = this.currentWeather;
    if (w === 'STORM') return 'stressed';
    if (w === 'FLOW') return 'excited';
    if (w === 'BONDING') return 'warm';
    if (w === 'FRAGMENTED') return 'jittery';
    return 'neutral';
  }

  async _synthesizeFish(text, emotion) {
    try {
      console.log(`[Siren] ðŸ§¬ Requesting local synthesis from ${this.config.fishSpeechUrl}...`);
      const response = await axios.post(`${this.config.fishSpeechUrl}/v1/tts`, {
        text,
        prosody: this._mapEmotionToProsody(emotion),
        streaming: false
      }, { 
        responseType: 'arraybuffer',
        timeout: 45000 
      });

      if (!response.data || response.data.byteLength < 100) {
        return { success: false, error: 'Empty audio buffer returned' };
      }

      const filename = `siren_${Date.now()}.wav`;
      const filePath = path.join(process.cwd(), 'data', 'audio', 'cache', filename);
      await fs.writeFile(filePath, response.data);

      console.log(`[Siren] âœ… Local synthesis successful: ${filename} (${response.data.byteLength} bytes)`);
      return { success: true, audioPath: filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async _synthesizeEleven(text, emotion) {
    if (!this.config.elevenLabsKey) return { success: false, error: 'No ElevenLabs key' };

    try {
      const settings = this._mapEmotionToEleven(emotion);
      const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${this.config.voiceId}`,
        {
          text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: settings
        },
        {
          headers: { 'xi-api-key': this.config.elevenLabsKey, 'Content-Type': 'application/json' },
          responseType: 'arraybuffer',
          timeout: 20000
        }
      );

      const filename = `eleven_${Date.now()}.mp3`;
      const filePath = path.join(process.cwd(), 'data', 'audio', 'cache', filename);
      await fs.writeFile(filePath, response.data);

      return { success: true, audioPath: filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  _mapEmotionToEleven(emotion) {
    const profiles = {
      excited:  { stability: 0.4, similarity_boost: 0.8, style: 0.6 },
      warm:     { stability: 0.7, similarity_boost: 0.9, style: 0.2 },
      stressed: { stability: 0.3, similarity_boost: 0.7, style: 0.8 },
      jittery:  { stability: 0.2, similarity_boost: 0.6, style: 0.5 },
      neutral:  { stability: 0.5, similarity_boost: 0.75, style: 0.0 }
    };
    return profiles[emotion] || profiles.neutral;
  }

  _mapEmotionToProsody(emotion) {
    const profiles = {
      excited:  { speed: 1.2, volume: 1.1, pitch: 1.05 },
      warm:     { speed: 0.85, volume: 0.9, pitch: 0.95 },
      stressed: { speed: 1.3, volume: 1.2, pitch: 1.1 },
      jittery:  { speed: 1.15, volume: 1.0, pitch: 1.0 },
      neutral:  { speed: 1.0, volume: 1.0, pitch: 1.0 }
    };
    return profiles[emotion] || profiles.neutral;
  }
}



