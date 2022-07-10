import { Collection, MessageEmbed, Snowflake } from "discord.js";
import axios from "axios";
import { client } from "../index";
import { Components, DefaultMeta, Paths } from "@zikeji/hypixel";

const mojangCache: Collection<string, MojangResponse> = new Collection()

interface MojangResponse {
    id: string;
    name: string;
}

async function getMojang(username: string, bypassMojangRateLimit?: boolean): Promise<MojangResponse | "error"> {
    if (mojangCache.has(username)) {
        return mojangCache.get(username)!;
    }
    try {
        const mojang = await axios.get(`https://api.mojang.com/users/profiles/minecraft/${username}`);
        if (mojang.data) {
            mojangCache.set(username, mojang.data);
        }
        return mojang.data;
    } catch (error) {
        return "error";
    }
}

async function getMojangFromUuid(uuid: string): Promise<MojangResponse | "error"> {
    if (mojangCache.has(uuid)) {
        return mojangCache.get(uuid)!;
    }
    try {
        const mojang = await axios.get(`https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`);
        if (mojang.data) {
            mojangCache.set(uuid, {
                id: mojang.data.id,
                name: mojang.data.name
            });
            mojangCache.set(mojang.data.name, {
                id: mojang.data.id,
                name: mojang.data.name
            });
        }
        return {
            id: mojang.data.id,
            name: mojang.data.name
        }
    } catch (error) {
        return "error";
    }
}

function embed(title: string, description: string) {
    return new MessageEmbed()
        .setTitle(title)
        .setDescription(description)
        .setColor("#B5FF59")
        .setTimestamp()
        .setFooter(client.user?.username as string, client.user?.avatarURL()?.toString());
}

function errorEmbed(message: string, failedVerificationEmbed?: boolean) {
    
    for (let i = 0; i < bypassWords.length; i++) {
        if (message.includes(bypassWords[i])) {
            message = starWord(message);
        }
    }

    let embed = new MessageEmbed()
        .setColor("#ff0000")
        .setTitle("Error")
        .setDescription(message)
        .setFooter(client.user?.username as string, client.user?.avatarURL()?.toString());

    if (failedVerificationEmbed) {
        embed.setImage("https://i.imgur.com/fY7ZcNq.gif")
    }
    return embed
}

function ephemeralMessage(channelId: Snowflake) {
    if (client.config.discord.whitelistedChannels.includes(channelId)) {
        return false;
    }
    return !client.config.discord.commandChannels.includes(channelId);

}

export let cataXp = [
    [0, 0],
    [1, 50],
    [2, 125],
    [3, 235],
    [4, 395],
    [5, 625],
    [6, 955],
    [7, 1425],
    [8, 2095],
    [9, 3045],
    [10, 4385],
    [11, 6275],
    [12, 8940],
    [13, 12700],
    [14, 17960],
    [15, 25340],
    [16, 35640],
    [17, 50040],
    [18, 70040],
    [19, 97640],
    [20, 135640],
    [21, 188140],
    [22, 259640],
    [23, 356640],
    [24, 488640],
    [25, 668640],
    [26, 911640],
    [27, 1239640],
    [28, 1684640],
    [29, 2284640],
    [30, 3084640],
    [31, 4149640],
    [32, 5559640],
    [33, 7459640],
    [34, 9959640],
    [35, 13259640],
    [36, 17559640],
    [37, 23159640],
    [38, 30359640],
    [39, 39559640],
    [40, 51559640],
    [41, 66559640],
    [42, 85559640],
    [43, 109559640],
    [44, 139559640],
    [45, 177559640],
    [46, 225559640],
    [47, 285559640],
    [48, 360559640],
    [49, 453559640],
    [50, 569809640],
	[51, 769809640],
	[52, 969809640],
	[53, 1169809640],
	[54, 1369809640],
	[55, 1569809640],
	[56, 1769809640],
	[57, 1969809640],
	[58, 2169809640],
	[59, 2369809640],
	[60, 2569809640],
	[61, 2769809640],
	[62, 2969809640],
	[63, 3169809640],
	[64, 3369809640],
	[65, 3569809640],
	[66, 3769809640],
	[67, 3969809640],
	[68, 4169809640],
	[69, 4369809640],
	[70, 4569809640],
	[71, 4769809640],
	[72, 4969809640],
	[73, 5169809640],
	[74, 5369809640],
	[75, 5569809640],
	[76, 5769809640],
	[77, 5969809640],
	[78, 6169809640],
	[79, 6369809640],
	[80, 6569809640],
	[81, 6769809640],
	[82, 6969809640],
	[83, 7169809640],
	[84, 7369809640],
	[85, 7569809640],
	[86, 7769809640],
	[87, 7969809640],
	[88, 8169809640],
	[89, 8369809640],
	[90, 8569809640],
	[91, 8769809640],
	[92, 8969809640],
	[93, 9169809640],
	[94, 9369809640],
	[95, 9569809640],
	[96, 9769809640],
	[97, 9969809640],
	[98, 10169809640],
	[99, 10369809640]
];


function cataLevel(xp: number) {
    let level = 0
    let percentage = 0.0
    for (let i = 0; i < cataXp.length; i++) {
        if (cataXp[i][1] > xp) {
            level = cataXp[i][0]
            let a = xp - cataXp[i - 1][1]
            let b = cataXp[i][1] - cataXp[i - 1][1]
            percentage = a / b
            break;
        }

    }
    if (level === 0) {
        return 0
    }
    return level + percentage - 1;
}

function validUnicode(str: string) {
    return /[^\u0000-\u007f]/.test(str);
}

function cataExp(level: number) {
    if (Number.isInteger(level)) {
        return cataXp[level][1]
    }
    let xp = cataXp[Math.floor(level)][1]
    let decimal = Math.abs(level) - Math.floor(Math.abs(level))
    xp += (decimal * (cataXp[Math.floor(level) + 1][1] - cataXp[Math.floor(level)][1]))
    return xp;
}

function highestCataProfile(profiles: Components.Schemas.SkyBlockProfileCuteName[] & {meta: Omit<Paths.SkyblockProfiles.Get.Responses.$200, "profiles"> & DefaultMeta}, uuid: string) {
    try {
        if (profiles === null) {
            return undefined;
        }
        let latestProfile;
        for (let i = 0; i < profiles.length; i++) {
            if (!profiles[i]?.members[uuid].last_save) continue;
            if (!latestProfile) {
                latestProfile = profiles[i];
            } else if (profiles[i]?.members[uuid].last_save && latestProfile.members[uuid].last_save) {
                if (profiles[i]?.members[uuid].last_save! > latestProfile.members[uuid].last_save) {
                    latestProfile = profiles[i];
                }
            }
        }
        return latestProfile;
    } catch (error) {
        console.error(error)
        return undefined;
    }
}

function highestCataProfileOld(profiles: Components.Schemas.SkyBlockProfileCuteName[] & {meta: Omit<Paths.SkyblockProfiles.Get.Responses.$200, "profiles"> & DefaultMeta}, uuid: string) {
    try {
        let highestCataXp = -1;
        let highestProfile;
        if (profiles === null) return undefined;
        for (let i = 0; i < profiles.length; i++) {
            if (profiles[i]?.members[uuid].dungeons?.dungeon_types.catacombs.experience) {
                let cataXp = profiles[i]?.members[uuid].dungeons?.dungeon_types.catacombs.experience as number
                if (cataXp > highestCataXp) {
                    highestCataXp = cataXp;
                    highestProfile = profiles[i];
                }
            }
        }
        if (highestCataXp === 0) {
            return highestCataProfile(profiles, uuid);
        }
        return highestProfile;
    } catch (error) {
        return undefined;
    }
}

function getProfileByName(profiles: Components.Schemas.SkyBlockProfileCuteName[] & {meta: Omit<Paths.SkyblockProfiles.Get.Responses.$200, "profiles"> & DefaultMeta}, name: string) {
    try {
        if (profiles === null) {
            return undefined;
        }
        if (profiles.length === 0) {
            return undefined;
        }
        for (let i = 0; i < profiles.length; i++) {
            if (profiles[i]?.cute_name.toLowerCase() === name.toLowerCase()) {
                return profiles[i];
            }
        }
        return null;
    } catch (error) {
        return undefined;
    }
}

function fmtMSS(number: number) {
    let ms: number | string = (number % 1000).toString();
    if (ms.length === 2) {
        ms = "0" + ms;
    }
    let minutes = Math.floor(number / 60000);
    let seconds = Math.floor(((number % 60000) / 1000))
    return minutes + ":" + (seconds < 10 ? '0' : '') + seconds + "." + (ms);
}

export const bypassWords = [
    "nigger",
    "ni99er",
    "Niggers",
    "Niggaz",
    "Nigga",
    "nigg3rs",
    "nig9er",
    "𝓷𝓲𝓰𝓰𝓮𝓻𝓼",
    "ℕ𝕀𝔾𝔾𝔼ℝ𝕊",
    "ℕ𝕀𝕘𝓰ᵉ𝔯ˢ",
    "𝖓𝖎𝖌𝖌𝖊𝖗𝖘",
    "N I G G E R S",
    "𝔫𝔦𝔤𝔤𝔢𝔯𝔰",
    "𝒩𝐼𝒢𝒢𝐸𝑅𝒮",
    "ɴɪɢɢᴇʀꜱ",
    "🄽🄸🄶🄶🄴🅁🅂",
    "𝙉𝙄𝙂𝙂𝙀𝙍𝙎",
    "𝘕𝘐𝘎𝘎𝘌𝘙𝘚",
    "🅽🅸🅶🅶🅴🆁🆂",
    "ₙᵢGGₑᵣₛ",
    "nigg",
    "N-IGGER",
    "NIGGE-RS",
    "NIGG-ERS",
    "NIG-GERS",
    "NI-GGERS",
    "N-IGGERS",
    "NI==GERS",
    "NI==GGERS",
    "NlGGERS",
    "NlGGER",
    "N1GGERS",
    "N1GGER",
    "ＮＩＧＧＥＲＳ",
    "░N░I░G░G░E░R░S░",
    "ＮＩＧＧΞＲＳ",
    "[̲̅N][̲̅I][̲̅G][̲̅G][̲̅E][̲̅R][̲̅S]",
    "ហįƓƓƐའϚ",
    "N̳I̳G̳G̳E̳R̳S̳",
    "N̾I̾G̾G̾E̾R̾S̾",
    "N͎I͎G͎G͎E͎R͎S͎",
    "N͓̽I͓̽G͓̽G͓̽E͓̽R͓̽S͓̽",
    "N.I.G.G.E.R.S",
    "N.I.GGERS",
    "N.IGGERS",
    "NIG.GERS",
    "ŇᎥ𝓖Ǥέｒ𝔰",
    "𝐧ＩｇᎶ𝐄ｒ𝔰",
    "NIGGERCANCER",
    "ni99ers",
    "nig9ers",
    "nig90rs",
    "niglet",
    "N卐GGERS",
    "N卐GGA",
    "N卐GGER",
    "NIG..GERS",
    "𝕟𝕚𝕘𝕘𝕖𝕣𝕤",
    "ɴɪɢɢᴇʀs",
    "ⓝⓘⓖⓖⓔⓡⓢ",
    "🅝🅘🅖🅖🅔🅡🅢",
    "nιggerѕ",
    "🅝🅘🅖🅖🅔🅡S",
    "🅝🅘🅖🅖🅔R🅢",
    "ⓝⓘⓖⓖⓔⓡ",
    "🅝🅘G🅖🅔🅡🅢",
    "𝕟𝕚𝕘𝕘𝕖𝕣",
    "ℕ𝕀𝔾𝔾𝔼ℝ",
    "𝒩𝐼𝒢𝒢𝐸𝑅",
    "𝓝𝓘𝓖𝓖𝓔𝓡",
    "ɴɪɢɢᴇʀ",
    "ₙᵢGGₑᵣ",
    "🅽🅸🅶🅶🅴🆁",
    "ᴺᴵᴳᴳᴱᴿ",
    "𝐍𝐈𝐆𝐆𝐄𝐑",
    "𝗡𝗜𝗚𝗚𝗘𝗥",
    "𝘕𝘐𝘎𝘎𝘌𝘙",
    "𝙉𝙄𝙂𝙂𝙀𝙍",
    "𝙽𝙸𝙶𝙶𝙴𝚁",
    "░N░I░G░G░E░R░",
    "≋N≋I≋G≋G≋E≋R≋",
    "『N』『I』『G』『G』『E』『R』",
    "【N】【I】【G】【G】【E】【R】",
    "ＮＩＧＧＥＲ",
    "ＮＩＧＧＥＲ】",
    "ᑎIGGEᖇ",
    "N̴I̴G̴G̴E̴R̴",
    "N̲I̲G̲G̲E̲R̲",
    "N̳I̳G̳G̳E̳R̳",
    "N̾I̾G̾G̾E̾R̾",
    "♥️N♥️I♥️G♥️G♥️E♥️R",
    "N͎I͎G͎G͎E͎R͎",
    "N͓̽I͓̽G͓̽G͓̽E͓̽R͓̽",
    "Ň𝕀𝓖𝓖𝑒г",
    "ℕ𝐢Ğ𝐠ⓔ𝐫",
    "🇳 🇮 🇬 🇬 🇪 🇷 🇸",
    "toadstar",
    "NIG",
    "Nigger",
    "NIGGERFAGGOT",
    "Nigg",
    "NIGG",
    "NIG9ERS",
    "cunt",
    "cnut",
    "pussy",
    "blowjob",
    "cock",
    "c0ck",
    "faggot",
    "nigger",
    "coon",
    "nig",
    "nig nog",
    "fag ",
    "rape",
    "r4pe",
    "nigga",
    "retard",
    "retarded",
    "fag",
    "faggot",
    "nigga",
    "nigger",
    "r4pe",
    "r@pe",
    "n i g g e r",
    "n i g g a",
    "f a g",
    "f4g",
    "f 4 g",
    "f@g",
    "f @ g",
    "cock",
    "c o c k",
    "c0ck",
    "c 0 c k",
    "pussy",
    "pu$$y",
    "p u s s y",
    "p u $ $ y",
    "co0n",
    "c00n",
    "c0on",
    "c o 0 n",
    "c 0 0 n",
    "c 0 o n",
    "cum",
    "c u m",
    "kys",
    "retards",
    "cunts",
    "niggas",
    "niger",
    "tranny",
    "nig.ge.r",
    "niggaz",
    "gger",
    "tard",
    "🇷 🇪 🇹 🇦 🇷 🇩",
    "ni ger",
    "noger",
    "n1ger",
    "nigerr",
    "Niggerr",
    "𝓷𝓲𝓰𝓰𝓮𝓻",
    "ni-"
];

function starWord(word: string) {
    let stared = "";
    for (let i = 0; i < word.length; i++) {
        stared = stared + "*";
    }
    return stared;
}


export { getMojang, errorEmbed, ephemeralMessage, highestCataProfileOld, highestCataProfile, getProfileByName, cataLevel, embed, fmtMSS, starWord, cataExp, validUnicode, getMojangFromUuid, MojangResponse }