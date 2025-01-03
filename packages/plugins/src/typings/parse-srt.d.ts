// import * from 'parse-srt';

declare module 'parse-srt' {
    export declare type ParsedSRT = {
        id: number;
        start: number;
        end: number;
        text: string;
    };

    declare function parseSRT(srt: string): ParsedSRT[];

    export default parseSRT;
}
