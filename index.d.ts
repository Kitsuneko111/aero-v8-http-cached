import Dispatcher from "undici/types/dispatcher";

// this isn't declared in the undici types so i have to do this shitfuckery
declare type UndiciOptions = Partial<{ dispatcher?: Dispatcher } & Omit<Dispatcher.RequestOptions, 'origin' | 'path' | 'method'> & Partial<Pick<Dispatcher.RequestOptions, 'method'>>>;

declare class Request {
    url: URL;
    httpMethod: string;
    data: any;
    sendDataAs: any;
    reqHeaders: Record<string, string>;
    streamEnabled: boolean;
    compressionEnabled: boolean;
    ua: string;
    coreOptions: UndiciOptions;
    timeoutDuration: number;
    redirectCount: number;

    constructor(url: string | URL);

    //#region Options 
    
    query(obj: Record<string, any>): this;
    query(name: string, value: string): this;
    path(...relativePaths: string[]): this;
    body(data: any, sendAs?: string): this;
    header(obj: Record<string, any>): this;
    header(name: string, value: string): this;
    timeout(timeout: number): this;
    agent(...fragments: any[]): this;
    options(obj: UndiciOptions): this;
    options<T extends keyof UndiciOptions>(key: T, value: UndiciOptions[T]): this;
    auth(token: string, type?: string): this;
    follow(count: number | boolean): this;

    //#endregion
    
    //#region HTTP methods

    method(method: string): this;
    get(): this;
    post(): this;
    patch(): this;
    put(): this;
    delete(): this;
    
    //#endregion

    json<T = any>(): Promise<T>;
    raw(): Promise<ArrayBuffer>;
    text(): Promise<string>;
    send(): Promise<Dispatcher.ResponseData>;
}

declare function req(url: string | URL): Request;

export = req;
