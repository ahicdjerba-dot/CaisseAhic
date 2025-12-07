// This file allows TypeScript to recognize the custom API
// that will be exposed by the Electron preload script.

export interface IElectronAPI {
  printDirect: (args: { html: string; printer?: string }) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
