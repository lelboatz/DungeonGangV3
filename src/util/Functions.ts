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

function embed(title: string, description: string) {
    return new MessageEmbed()
        .setTitle(title)
        .setDescription(description)
        .setColor("#B5FF59")
        .setTimestamp()
        .setFooter(client.user?.username as string, client.user?.avatarURL()?.toString());
}

function errorEmbed(message: string, failedVerificationEmbed?: boolean) {
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
    [51, 703413934],
    [52, 869735456],
    [53, 1071044557],
    [54, 1313825546],
    [55, 1605608643],
    [56, 1955114521],
    [57, 2372415627],
    [58, 2869115845],
    [59, 3458550220],
    [60, 4156006571],
    [61, 1000000000000]
]

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
    return level + percentage - 1;
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
            return void 0;
        }
        let latestProfile;
        for (let i = 0; i < profiles.length; i++) {
            if (!latestProfile) {
                latestProfile = profiles[i];
            } else if (profiles[i]?.members[uuid].last_save && latestProfile.members[uuid].last_save) {
                if (profiles[i]?.members[uuid].last_save! > latestProfile.members[uuid].last_save) {
                    latestProfile = profiles[i];
                }
            }
        }
        return latestProfile;
    } catch {
        return void 0;
    }
}

function highestCataProfileOld(profiles: Components.Schemas.SkyBlockProfileCuteName[] & {meta: Omit<Paths.SkyblockProfiles.Get.Responses.$200, "profiles"> & DefaultMeta}, uuid: string) {
    try {
        let highestCataXp = -1;
        let highestProfile;
        if (profiles === null) return void 0;
        for (let i = 0; i < profiles.length; i++) {
            if (profiles[i]?.members[uuid].dungeons?.dungeon_types.catacombs.experience) {
                let cataXp = profiles[i]?.members[uuid].dungeons?.dungeon_types.catacombs.experience as number
                if (cataXp > highestCataXp) {
                    highestCataXp = cataXp;
                    highestProfile = profiles[i];
                }
            }
        }
        return highestProfile;
    } catch (error) {
        return void 0;
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


export { getMojang, errorEmbed, ephemeralMessage, highestCataProfile, cataLevel, embed, fmtMSS, cataExp, MojangResponse }