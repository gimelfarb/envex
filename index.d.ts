import { ReadStream } from "fs";

declare namespace envex {
    interface Config {
        profiles?: ProfilesConfig;
    }

    interface ProfilesConfig {
        [name: string]: ProfileConfig;
    }

    interface ProfileConfig {
        profile?: string | string[];
        imports?: string | string[];
        cwd?: string;
        env?: EnvConfig;
        expose?: ExposeConfig;
    }

    ///////////////////        ENV         ////////////////////

    type EnvConfig = EnvConfigMap | EnvConfigFunction | EnvConfigList;
    type EnvConfigList = Array<EnvConfigMap | EnvConfigFunction | string>;
    type EnvConfigFunction = (ctx: EnvBaseContext) => EnvResolved | Promise<EnvResolved>;

    interface EnvBaseContext {
        readonly env: EnvResolved;
        has(name: string): boolean;
    }

    interface EnvConfigMap {
        [name: string]: EnvVarConfig;
    }

    type EnvVarConfig = EnvValue<string> | EnvVarConfigExplicit;

    interface EnvVarConfigExplicit {
        required?: boolean;
        value?: EnvValue<string>;
    }

    type EnvValue<T> = T | EnvValueFunction<T>;
    type EnvValueFunction<T> = (ctx: EnvResolveContext) => T | Promise<T>;

    interface EnvResolveContext extends EnvBaseContext {
        resolve(s: string): Promise<string>;
    }

    interface EnvResolved {
        readonly [name: string]: string;
    }


    ////////////////          EXPOSE            //////////////////

    type ExposeConfig = ExposeMap | ExposeFunction | ExposeList;
    type ExposeList = Array<ExposeMap | ExposeFunction | string>;
    type ExposeFunction = ExposeValueFunction<ExposeResolved>;

    interface ExposeMap {
        [name: string]: ExposeVarConfig;
    }

    type ExposeVarConfig = ExposeValue<string> | ExposeVarConfigExplicit;

    interface ExposeVarConfigExplicit {
        regex?: EnvValue<string | RegExp>;
    }

    type ExposeValue<T> = T | ExposeValueFunction<T>;
    type ExposeValueFunction<T> = ExposeValueDirectFunction<T> | ExposeValueIndirectFunction<T>;
    type ExposeValueDirectFunction<T> = (ctx: ExposeContext) => T | Promise<T>;
    type ExposeValueIndirectFunction<T> = (ctx: ExposeContext, expose: (value: T) => void) => void;

    interface ExposeContext {
        readonly env: EnvResolved;
        readonly tap: ReadStream;
    }

    interface ExposeResolved {
        readonly [name: string]: string;
    }
}