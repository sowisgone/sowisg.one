/// <reference types="astro/client" />

interface ImportMetaEnv {
	readonly DISCORD_USER_ID: string;
	readonly GITHUB_TOKEN: string;
	readonly STEAM_API_KEY: string;
	readonly STEAM_ID: string;
	readonly PUBLIC_GITHUB_TOKEN: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
