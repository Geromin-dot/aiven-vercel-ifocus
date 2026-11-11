import { expect, test } from '@playwright/test';
import { accountFixture } from './account-fixture.mjs';

test('soundscape volume changes the audio output without restarting playback', async ({ page, context }) => {
  await accountFixture(context);
  await page.addInitScript(() => {
    localStorage.setItem('ifocus_music_state', JSON.stringify({
      isPlaying: false, currentTrack: 'Study Music', volume: 100,
    }));

    // Simulate a browser that ignores changes to the native media volume.
    Object.defineProperty(HTMLMediaElement.prototype, 'volume', { get: () => 1, set() {} });
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (destination, ...args) {
      const result = connect.call(this, destination, ...args);
      if (this instanceof MediaElementAudioSourceNode && destination instanceof GainNode) {
        const input = this.context.createAnalyser();
        const output = this.context.createAnalyser();
        connect.call(this, input);
        connect.call(destination, output);
        window.soundscapeMeters = { input, output };
      }
      return result;
    };
  });

  await page.goto('/');
  await page.getByRole('link', { name: /Open Dashboard/ }).click();
  await page.getByTitle('Click to open Soundscape Player').click();
  await page.getByRole('button', { name: 'Play Soundscape' }).click();
  const audio = page.locator('audio');
  await expect(audio).toHaveAttribute('src', /Study%20Music\.mp3$/);
  await expect.poll(() => audio.evaluate(element => ({
    playing: element.currentTime > 0.5, error: element.error?.message, state: element.readyState,
  }))).toMatchObject({ playing: true });
  const before = await audio.evaluate(element => {
    window.soundscapeReloads = 0;
    element.addEventListener('loadstart', () => window.soundscapeReloads++);
    return element.currentTime;
  });

  const slider = page.getByRole('slider', { name: 'Soundscape volume' });
  const outputRatio = () => page.evaluate(() => {
    const meters = window.soundscapeMeters;
    if (!meters) return -1;
    const energy = analyser => {
      const samples = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(samples);
      return samples.reduce((sum, sample) => sum + sample * sample, 0);
    };
    const inputEnergy = energy(meters.input);
    return inputEnergy > 0 ? Math.sqrt(energy(meters.output) / inputEnergy) : -1;
  });

  for (const percent of [100, 50, 10, 1, 0, 25]) {
    await slider.fill(String(percent));
    await expect.poll(outputRatio).toBeCloseTo(percent / 100, 2);
  }

  expect(await page.evaluate(() => window.soundscapeReloads)).toBe(0);
  expect(await audio.evaluate(element => element.currentTime)).toBeGreaterThan(before);
  await page.getByRole('button', { name: 'Pause Audio' }).click();
  await expect.poll(() => audio.evaluate(element => element.paused)).toBe(true);
});
