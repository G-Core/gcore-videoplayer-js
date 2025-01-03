declare module "kibo" {
    declare class Kibo {
        constructor(element: HTMLElement | Document);
        // on(key: string, callback: (e: KeyboardEvent) => void): void;
        off(key: string | string[]): void;
        down(key: string | string[], callback: (e: KeyboardEvent) => void): void;
        up(key: string | string[], callback: (e: KeyboardEvent) => void): void;
    }
    export default Kibo;
}
