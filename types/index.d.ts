import Dispatcher from 'undici/types/dispatcher';

type bodyType = 'json' | 'buffer' | 'form' | 'multipart';
type method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
type authType = 'Bearer' | 'Basic';

declare class RequestClass extends Promise<Dispatcher.ResponseData> {
    private url: URL;
    private httpMethod: string;
    private data: any;
    private sendDataAs: any;
    private reqHeaders: Record<string, string>;
    private streamEnabled: boolean;
    private compressionEnabled: boolean;
    private ua: string;
    private coreOptions: req.UndiciOptions;
    private timeoutDuration: number;
    private redirectCount: number;
    private requestAdapter: "undici" | "fetch";

    
    constructor(url: string | URL);

    //#region Options

    query(obj: Record<string, any>): this;
    query(map: Map<string, string>): this;
    query(arr: [string, string][]): this;
    query(name: string, value: string): this;
    path(...relativePaths: string[]): this;
    body(data: any, sendAs?: bodyType): this;
    header(obj: Record<string, any>): this;
    header(map: Map<string, string>): this;
    header(arr: [string, string][]): this;
    header(name: string, value: string): this;
    timeout(timeout: number): this;
    agent(...fragments: string[]): this;
    options(obj: req.UndiciOptions): this;
    options<T extends keyof req.UndiciOptions>(
        key: T,
        value: req.UndiciOptions[T]
    ): this;
    auth(token: string, type?: authType | string): this;
    follow(count: number | boolean): this;
    proxy(uri: string, token?: string): this;

    //#endregion

    //#region HTTP methods

    method(method: method): this;
    get(): this;
    post(): this;
    patch(): this;
    put(): this;
    delete(): this;

    //#endregion

    //#region Adapters

    adapter(name: "undici" | "fetch"): this;
    undici(): this;
    fetch(): this;
    native(): this;

    //#endregion

    json<T = any>(): Promise<T>;
    raw(): Promise<ArrayBuffer>;

    text(): Promise<string>;
    send(): Promise<Dispatcher.ResponseData>;
}

declare namespace req {
    export class Request extends RequestClass {}
    export type Response = Dispatcher.ResponseData;
    export type UndiciOptions = Partial<
        { dispatcher?: Dispatcher } & Omit<
            Dispatcher.RequestOptions,
            'origin' | 'path' | 'method'
        > &
            Partial<Pick<Dispatcher.RequestOptions, 'method'>>
    >;
}
declare function req(url: string | URL): req.Request;

export = req;
