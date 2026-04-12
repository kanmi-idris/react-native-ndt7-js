declare module '@m-lab/ndt7' {
  const ndt7: {
    discoverServerURLs: (config: Record<string, unknown>, callbacks: Record<string, unknown>) => Promise<Record<string, string>>;
  };

  export default ndt7;
}
