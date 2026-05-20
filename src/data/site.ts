export const socials = [
	{ label: 'twitter', href: 'https://twitter.com/sowisgone' },
	{ label: 'yt_jobs', href: 'https://ytjobs.co/talent/profile/528200?r=386' },
	{ label: 'steam', href: 'https://steamcommunity.com/id/sowisgone/' },
	{ label: 'twitch', href: 'https://twitch.tv/sowisgonexd' },
];

export const projects = ['sweety inc, a pc tweaker', 'skulldye, a game'];

export const skills = ['js', 'writting', 'mcfunction', 'bat', 'blender', 'godot'];

export const about = {
	age: '18y',
	location: 'Brazil',
	email: 'sowisgone@gmail.com',
	postsDescription: 'Currently I\'m making some posts on this page of my website, like a "blog" of sorts. Check it out down below if you wanna see me freaking out on some stuff lol',
	description: 'Been making small projects since 2019, participating in many projects. I\'ve worked as a scriptwritter and RPG master for a decade now. Currently, my main focus is working on my future game, SKULLDYE, and doing some stuff in Minecraft. Feel welcome to email me or send me a message on Discord asking anything. If the topic comes to be collabing on a project, send me an email on it!'
};

export const posts = [{ label: 'blog', href: '/blog' }];

export const map = {
	phoneMasked: '+55 ** *****-****',
	image: '/img/map.webp',
};

export interface BlogDateEntry {
	id: string;
	label: string;
}

export const blogDates: BlogDateEntry[] = [
	{ id: '2026-05-18', label: '2026-05-18' },
	{ id: '2026-05-10', label: '2026-05-10' },
];

export const blogDayLog = {
	command: './day.log',
	content: 'TODO: blog post content will go here.',
};

// ============================================================================
// SYSTEM LOGS TREE TYPE & RECURSIVE SORTING
// ============================================================================

export interface LogItem {
  name: string;
  type: 'folder' | 'file';
  urlPath?: string;
  children: LogItem[];
}

export function sortLogItems(items: LogItem[]): LogItem[] {
  return [...items]
    .sort((a, b) => {
      // Keep folders grouped on top of loose files
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      // Natural sorting: 0-9 comes before a-z natively
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    })
    .map(item => ({
      ...item,
      children: sortLogItems(item.children)
    }));
}