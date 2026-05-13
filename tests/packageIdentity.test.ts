import { describe, expect, it } from 'vitest';

import packageJSON from '../package.json';
import { resolveNdt7ServerURLs } from '../src/discoverServer';

describe('package identity', () => {
  it('reports package.json identity through resolved NDT7 server URLs', async () => {
    const urls = await resolveNdt7ServerURLs({
      server: 'ndt.example.test',
      protocol: 'wss',
    });
    const downloadURL = urls['///ndt/v7/download'];
    expect(downloadURL).toBeDefined();

    const metadata = new URL(downloadURL as string).searchParams;

    expect(metadata.get('client_library_name')).toBe(packageJSON.name);
    expect(metadata.get('client_library_version')).toBe(packageJSON.version);
  });
});
