import { client, DungeonGang } from "../index";
import { Guild, GuildMember, GuildMemberRoleManager, MessageEmbed, Snowflake, TextChannel } from "discord.js";
import {
    cataLevel,
    fmtMSS,
    getMojang,
    getProfileByName,
    highestCataProfileOld, MojangResponse
} from "./Functions";
import { MongoUser } from "./Mongo";
import { userSchema } from "./Schema";
import EmojiManager from "./EmojiManager";

export interface VerifyLogData {
    mojang: MojangResponse;
    cataLevel: number;
    member: GuildMember;
    rolesBefore: Snowflake[];
    rolesAfter: Snowflake[];
    handler: string;
    stats?: {
        secrets: number;
        bloodMobs: number;
        floorSeven: number | undefined;
        masterFive: number | undefined;
        masterSix: number | undefined;
    }
}

export interface VerifyOptions {
    cataLevel?: number | null;
    profile?: string | null;
    bypassDiscord?: boolean | null;
    bypassApi?: boolean | null;
    overrideDuplicate?: boolean | null;
    forceUpdate?: {
        mojang: MojangResponse
    }
    handler: string;
}

export interface VerifyDungeonData {
    cataLevel: number;
    secrets: number;
    bloodMobs: number;
    floorSeven: number | undefined;
    masterFive: number | undefined;
    masterSix: number | undefined;
    masterSeven: number | undefined;
}

export interface MeetsReqsOptions {
    votedIn: boolean
    votedOut: boolean
}

export enum VerifyErrors {
    INVALID_USERNAME,
    HYPIXEL_ERROR,
    NO_DISCORD,
    HYPIXEL_DISCORD_MISMATCH,
    MONGO_DISCORD_MISMATCH,
    INVALID_PROFILE,
    MISSING_CATA_LEVEL,
    INVALID_CATA_LEVEL,
}

class VerificationManager {
    client: DungeonGang;
    constructor(client: DungeonGang) {
        this.client = client;
    }

    async verify(username: string, member: GuildMember, options: VerifyOptions ) {

        let mojang;
        if (!options.forceUpdate) {
            mojang = await getMojang(username);
        } else {
            mojang = options.forceUpdate.mojang;
        }

        if (mojang === "error" || !mojang) {
            return {
                success: false,
                code: VerifyErrors.INVALID_USERNAME,
            }
        }

        if (options.bypassApi === false) {
            if (!options.cataLevel) {
                return {
                    success: false,
                    code: VerifyErrors.MISSING_CATA_LEVEL,
                }
            }

            if (options.cataLevel < 0 || options.cataLevel > 60) {
                return {
                    success: false,
                    code: VerifyErrors.INVALID_CATA_LEVEL,
                }
            }

            let mongoUser = await this.client.mongo.getUser(mojang.id) as MongoUser | null | undefined;

            if (!mongoUser) {
                await this.client.mongo.addUser(userSchema(member.id, mojang.id));
                mongoUser = await this.client.mongo.getUser(mojang.id) as MongoUser | undefined;
            } else {
                if (mongoUser.discordId && mongoUser.discordId !== member.id && mongoUser.discordId !== null) {
                    const otherMember = await this.fetchMember(mongoUser.discordId, member.guild);
                    if (otherMember) {
                        if (!options.overrideDuplicate) {
                            return {
                                success: false,
                                code: VerifyErrors.MONGO_DISCORD_MISMATCH,
                            }
                        } else {
                            mongoUser.discordId = member.id;
                            if (otherMember.manageable) {
                                await otherMember.edit({
                                    nick: null,
                                    roles: this.client.config.discord.roles.fixRoles
                                })
                            }
                        }
                    } else {
                        mongoUser.discordId = member.id;
                    }
                } else {
                    mongoUser.discordId = member.id;
                }
            }

            if (member.roles.cache.has(this.client.config.discord.roles.topPlayer.votedOut)) {
                if (mongoUser) {
                    mongoUser.votedOut = true;
                }
            }

            if (member.roles.cache.has(this.client.config.discord.roles.topPlayer.plusReq)) {
                if (mongoUser) {
                    mongoUser.votedIn = true;
                }
            }

            if (mongoUser) await this.client.mongo.updateUser(mongoUser);

            const roles = this.arrayRoleIds(member.roles);

            if (options.cataLevel >= 30 && options.cataLevel <= 34) {
                if (!roles.includes(this.client.config.discord.roles.cata["30"])) {
                    roles.push(this.client.config.discord.roles.cata["30"]);
                }
            } else if (options.cataLevel >= 35) {
                if (!roles.includes(this.client.config.discord.roles.cata["35"])) {
                    roles.push(this.client.config.discord.roles.cata["35"]);
                }
            }

            if (!roles.includes(this.client.config.discord.roles.member)) {
                roles.push(this.client.config.discord.roles.member);
            }

            let symbol: string | undefined = undefined;

            for (const [key, value] of Object.entries(this.client.config.discord.symbols)) {
                if (roles.includes(key)) {
                    symbol = value
                }
            }

            const manager = new EmojiManager(member)
            await manager.update()
            await manager.sync()
            const emojis = manager.toString()

            let nickname = `❮${options.cataLevel}❯ ${mojang.name} ${emojis}`;
            if (symbol) nickname = nickname.replace(/[❮❯]/g, symbol)

            const oldRoles = this.arrayRoleIds(member.roles);

            await member.edit({
                roles,
                nick: member.manageable ? nickname : undefined
            }, options.handler)

            try {
                this.logVerification({
                    mojang,
                    cataLevel: options.cataLevel,
                    member,
                    rolesBefore: oldRoles,
                    rolesAfter: roles,
                    handler: options.handler,
                })
            } catch {

            }

            return {
                success: true,
                mojang
            }
        }

        let discord;
        let player;
        try {
            player = await this.client.hypixel.player.uuid(mojang.id);
            discord = player.socialMedia?.links?.DISCORD ?? player.socialMedia?.DISCORD;
        } catch (error: any) {
            console.error(error);
            return {
                success: false,
                code: VerifyErrors.HYPIXEL_ERROR,
                message: error.message
            }
        }

        if (!discord && !options.bypassDiscord) {
            return {
                success: false,
                code: VerifyErrors.NO_DISCORD,
            }
        }

        if (discord !== member.user.tag && !options.bypassDiscord) {
            return {
                success: false,
                code: VerifyErrors.HYPIXEL_DISCORD_MISMATCH,
                tag: discord,
                mojang
            }
        }

        let user = await this.client.mongo.getUser(mojang.id) as MongoUser | null | undefined;

        if (!user) {
            await this.client.mongo.addUser(userSchema(member.user.id, mojang.id));
            user = await this.client.mongo.getUser(mojang.id) as MongoUser | undefined;
        } else {
            if (user.discordId && user.discordId !== member.user.id && user.discordId !== null) {
                const otherMember = await this.fetchMember(user.discordId, member.guild);
                if (otherMember) {
                    if (!options.overrideDuplicate) {
                        return {
                            success: false,
                            code: VerifyErrors.MONGO_DISCORD_MISMATCH,
                            mojang,
                            member: otherMember
                        }
                    } else {
                        user.discordId = member.id;
                        if (otherMember.manageable) {
                            await otherMember.edit({
                                nick: null,
                                roles: this.client.config.discord.roles.fixRoles
                            })
                        }
                    }
                } else {
                    user.discordId = member.id;
                }
            } else {
                user.discordId = member.id;
            }
        }

        let roles = member.roles as GuildMemberRoleManager
        let rolesArray = this.arrayRoleIds(roles)

        let profile;
        try {
            if (options.profile) {
                profile = getProfileByName(await this.client.hypixel.skyblock.profiles.uuid(mojang.id), options.profile);
                if (profile === null) {
                    return {
                        success: false,
                        code: VerifyErrors.INVALID_PROFILE,
                    }
                }
            } else {
                profile = highestCataProfileOld(await this.client.hypixel.skyblock.profiles.uuid(mojang.id), mojang.id)
            }
        } catch (error: any) {
            if (error.message === 'Key "profiles" is not an array.') {
                profile = undefined
            } else {
                console.error(error);
                return {
                    success: false,
                    code: VerifyErrors.HYPIXEL_ERROR,
                    message: error.message
                }
            }
        }

        let dungeons;

        if (!profile) {
            dungeons = {
                cataLevel: 0,
                secrets: player.achievements?.skyblock_treasure_hunter ?? 0,
                bloodMobs: 0,
                floorSeven: undefined,
                masterFive: undefined,
                masterSix: undefined,
                masterSeven: undefined
            }
        } else {
            dungeons = {
                cataLevel: Math.floor(cataLevel(profile.members[mojang.id].dungeons?.dungeon_types.catacombs.experience ?? 0)),
                secrets: player.achievements?.skyblock_treasure_hunter ?? 0,
                bloodMobs: (profile.members[mojang.id].stats.kills_watcher_summon_undead ?? 0) + (profile.members[mojang.id].stats.kills_watcher_summon_skeleton ?? 0) + (profile.members[mojang.id].stats.kills_master_watcher_summon_undead ?? 0),
                floorSeven: profile.members[mojang.id].dungeons?.dungeon_types.catacombs.fastest_time_s_plus?.[7] ?? undefined,
                masterFive: profile.members[mojang.id].dungeons?.dungeon_types.master_catacombs?.fastest_time_s_plus?.[5] ?? undefined,
                masterSix: profile.members[mojang.id].dungeons?.dungeon_types.master_catacombs?.fastest_time_s_plus?.[6] ?? undefined,
                masterSeven: profile.members[mojang.id].dungeons?.dungeon_types.master_catacombs?.fastest_time_s_plus?.[7] ?? undefined
            }
        }

        if (member.roles.cache.has(this.client.config.discord.roles.topPlayer.votedOut)) {
            if (user) {
                user.votedOut = true;
            }
        } else {
            if (user) {
                user.votedOut = false;
            }
        }

        if (member.roles.cache.has(this.client.config.discord.roles.topPlayer.plusReq)) {
            if (user) {
                user.votedIn = true;
            }
        } else {
            if (user) {
                user.votedIn = false;
            }
        }

        if (user) {
            await this.client.mongo.updateUser(user)
        }

        let tpp = this.meetsTopPlusReqs(dungeons, {
            votedOut: user?.votedOut ?? false,
            votedIn: user?.votedIn ?? false,
        }), tp = this.meetsTopNormalReqs(dungeons), tpm = this.meetsTopMinusReqs(dungeons), speedrunner = this.meetsSpeedrunnerReqs(dungeons), secretDuper = this.meetsSecretDuperReqs(dungeons);

        if (tpp || tp) tpm = false;

        // Removing Roles from Array

        for (const [, value] of Object.entries(this.client.config.discord.roles.cata)) {
            if (rolesArray.includes(value)) {
                rolesArray.splice(rolesArray.indexOf(value), 1)
            }
        }

        if (rolesArray.includes(this.client.config.requirements.topPlus.role)) {
            rolesArray.splice(rolesArray.indexOf(this.client.config.requirements.topPlus.role), 1)
        }

        if (rolesArray.includes(this.client.config.requirements.topNormal.role)) {
            rolesArray.splice(rolesArray.indexOf(this.client.config.requirements.topNormal.role), 1)
        }

        if (rolesArray.includes(this.client.config.requirements.topMinus.role)) {
            rolesArray.splice(rolesArray.indexOf(this.client.config.requirements.topMinus.role), 1)
        }

        if (rolesArray.includes(this.client.config.requirements.speedrunner.role)) {
            rolesArray.splice(rolesArray.indexOf(this.client.config.requirements.speedrunner.role), 1)
        }

        if (rolesArray.includes(this.client.config.requirements.secretDuper.role)) {
            rolesArray.splice(rolesArray.indexOf(this.client.config.requirements.secretDuper.role), 1)
        }

        // Adding Roles to Array

        if (tpp && !rolesArray.includes(this.client.config.requirements.topPlus.role)) {
            rolesArray.push(this.client.config.requirements.topPlus.role)
        }

        if (tp && !rolesArray.includes(this.client.config.requirements.topNormal.role)) {
            rolesArray.push(this.client.config.requirements.topNormal.role)
        }

        if (tpm && !rolesArray.includes(this.client.config.requirements.topMinus.role)) {
            rolesArray.push(this.client.config.requirements.topMinus.role)
        }

        if (speedrunner && !rolesArray.includes(this.client.config.requirements.speedrunner.role)) {
            rolesArray.push(this.client.config.requirements.speedrunner.role)
        }

        if (secretDuper && !rolesArray.includes(this.client.config.requirements.secretDuper.role)) {
            rolesArray.push(this.client.config.requirements.secretDuper.role)
        }


        if (dungeons.cataLevel < 30 || dungeons.cataLevel > 60) {

        } else if (dungeons.cataLevel >= 30 && dungeons.cataLevel <= 34) {
            rolesArray.push(this.client.config.discord.roles.cata["30"])
        } else if (dungeons.cataLevel >= 35 && dungeons.cataLevel <= 39) {
            rolesArray.push(this.client.config.discord.roles.cata["35"])
        } else {
            if (!tpp && !tp) {
                rolesArray.push(this.client.config.discord.roles.cata["35"])
            } else {
                // @ts-ignore
                rolesArray.push(this.client.config.discord.roles.cata[dungeons.cataLevel.toString()])
            }
        }

        let symbol: string | undefined = undefined;

        for (const [key, value] of Object.entries(this.client.config.discord.symbols)) {
            if (rolesArray.includes(key)) {
                symbol = value
            }
        }

        const manager = new EmojiManager(member)
        await manager.update()
        await manager.sync()
        const emojis = manager.toString()

        let nickname = `❮${dungeons.cataLevel}❯ ${mojang.name} ${emojis}`;
        if (symbol) nickname = nickname.replace(/[❮❯]/g, symbol)

        if (!rolesArray.includes(this.client.config.discord.roles.member)) {
            rolesArray.push(this.client.config.discord.roles.member)
        }

        const oldRoles = this.arrayRoleIds(member.roles)

        await member.edit({
            nick: member.manageable ? nickname : undefined,
            roles: rolesArray,
        }, options.handler)

        try {
            this.logVerification({
                mojang,
                cataLevel: dungeons.cataLevel,
                member,
                rolesBefore: oldRoles,
                rolesAfter: rolesArray,
                handler: options.handler,
                stats: {
                    secrets: dungeons.secrets,
                    bloodMobs: dungeons.bloodMobs,
                    floorSeven: dungeons.floorSeven,
                    masterFive: dungeons.masterFive,
                    masterSix: dungeons.masterSix,
                }
            })
        } catch(error) {
            console.error(error)
        }

        return {
            success: true,
            dungeons,
            mojang,

        }
    }

    logVerification(data: VerifyLogData) {
        const logChannel = client.channels.cache.get(client.config.discord.logChannel) as TextChannel
        const rolesRemoved = data.rolesBefore.filter(role => !data.rolesAfter.includes(role)).map(role => `<@&${role}>`).join("")
        const rolesAdded = data.rolesAfter.filter(role => !data.rolesBefore.includes(role)).map(role => `<@&${role}>`).join("")
        const stats = ( data.stats ? "Catacombs Level: " + data.cataLevel
            + "\nSecrets: " + data.stats.secrets
            + "\nBlood Mob Kills: " + data.stats.bloodMobs
            + "\nFloor 7 S+: " + (data.stats.floorSeven ? fmtMSS(data.stats.floorSeven!) : "N/A")
            + "\nMaster Five S+: " + (data.stats.masterFive ? fmtMSS(data.stats.masterFive!) : "N/A")
            + "\nMaster Six S+: " + (data.stats.masterSix ? fmtMSS(data.stats.masterSix!) : "N/A") : `Catacombs Level: ${data.cataLevel}`)
        return logChannel?.send({
            embeds: [
                new MessageEmbed()
                    .setTitle(`${data.mojang.name} has been verified!`)
                    .setDescription(`User: ${data.member.toString()}\nHandler: \`${data.handler}\`\nUUID: \`${data.mojang.id}\`\nTime: <t:${Math.floor(new Date().getTime() / 1000)}:R>`)
                    .addField("**Stats**", stats)
                    .addField("**Roles Added**", (rolesAdded !== "" ? rolesAdded : "None"))
                    .addField("**Roles Removed**", (rolesRemoved !== "" ? rolesRemoved : "None"))
                    .setFooter(this.client.user?.username as string, client.user?.avatarURL()?.toString())
                    .setColor("#B5FF59")
                    .setTimestamp()
                    .setThumbnail(`https://crafatar.com/avatars/${data.mojang.id}?overlay`)
            ]
        })
    }

    async fetchMember(id: string, guild: Guild) {
        return guild.members.fetch(id)
            .catch(() => {
                return undefined
            })
    }

    arrayRoleIds(roles: GuildMemberRoleManager) {
        return roles.cache.map(role => role.id)
    }

    meetsTopPlusReqs(dungeons: VerifyDungeonData, options: MeetsReqsOptions) {
        if (options.votedIn) {
            return true
        }
        if (options.votedOut) {
            return false
        }

        let meetsCata = false
        let meetsSecrets = false
        let meetsBloodMobs = false
        let meetsFloorSeven = false
        let meetsMasterFive = false
        let meetsMasterSix = false
        let meetsMasterSeven = false

        if (dungeons.cataLevel && dungeons.cataLevel >= this.client.config.requirements.topPlus.cata) {
            meetsCata = true
        }
        if (!dungeons.cataLevel) {
            meetsCata = true
        }
        if (this.client.config.requirements.topPlus.secrets !== null && dungeons.secrets >= this.client.config.requirements.topPlus.secrets) {
            meetsSecrets = true
        }
        if (this.client.config.requirements.topPlus.bloodMobs !== null && dungeons.bloodMobs >= this.client.config.requirements.topPlus.bloodMobs) {
            meetsBloodMobs = true
        }
        if (this.client.config.requirements.topPlus.floorSeven && dungeons.floorSeven && dungeons.floorSeven <= this.client.config.requirements.topPlus.floorSeven * 1000) {
            meetsFloorSeven = true
        }
        if (this.client.config.requirements.topPlus.masterFive && dungeons.masterFive && dungeons.masterFive <= this.client.config.requirements.topPlus.masterFive * 1000) {
            meetsMasterFive = true
        }
        if (this.client.config.requirements.topPlus.masterSix && dungeons.masterSix && dungeons.masterSix <= this.client.config.requirements.topPlus.masterSix * 1000) {
            meetsMasterSix = true
        }
        if (this.client.config.requirements.topPlus.masterSeven && dungeons.masterSeven && dungeons.masterSeven <= this.client.config.requirements.topPlus.masterSeven * 1000) {
            meetsMasterSeven = true
        }

        return meetsCata && (meetsSecrets || meetsBloodMobs) && (meetsFloorSeven || meetsMasterFive || meetsMasterSix || meetsMasterSeven);

    }

    meetsTopNormalReqs(dungeons: VerifyDungeonData) {
        let meetsCata = false
        let meetsSecrets = false
        let meetsBloodMobs = false
        let meetsFloorSeven = false
        let meetsMasterFive = false
        let meetsMasterSix = false
        let meetsMasterSeven = false

        if (dungeons.cataLevel && dungeons.cataLevel >= this.client.config.requirements.topNormal.cata) {
            meetsCata = true
        }
        if (!dungeons.cataLevel) {
            meetsCata = true
        }
        if (this.client.config.requirements.topNormal.secrets !== null && dungeons.secrets >= this.client.config.requirements.topNormal.secrets) {
            meetsSecrets = true
        }
        if (this.client.config.requirements.topNormal.bloodMobs !== null && dungeons.bloodMobs >= this.client.config.requirements.topNormal.bloodMobs) {
            meetsBloodMobs = true
        }
        if (this.client.config.requirements.topNormal.floorSeven && dungeons.floorSeven && dungeons.floorSeven <= this.client.config.requirements.topNormal.floorSeven * 1000) {
            meetsFloorSeven = true
        }
        if (this.client.config.requirements.topNormal.masterFive && dungeons.masterFive && dungeons.masterFive <= this.client.config.requirements.topNormal.masterFive * 1000) {
            meetsMasterFive = true
        }
        if (this.client.config.requirements.topNormal.masterSix && dungeons.masterSix && dungeons.masterSix <= this.client.config.requirements.topNormal.masterSix * 1000) {
            meetsMasterSix = true
        }
        if (this.client.config.requirements.topNormal.masterSeven && dungeons.masterSeven && dungeons.masterSeven <= this.client.config.requirements.topNormal.masterSeven * 1000) {
            meetsMasterSeven = true
        }

        return meetsCata && (meetsSecrets || meetsBloodMobs) && (meetsFloorSeven || meetsMasterFive || meetsMasterSix || meetsMasterSeven)
    }

    meetsTopMinusReqs(dungeons: VerifyDungeonData) {
        let meetsCata = false
        let meetsSecrets = false
        let meetsBloodMobs = false
        let meetsFloorSeven = false
        let meetsMasterFive = false
        let meetsMasterSix = false
        let meetsMasterSeven = false

        if (dungeons.cataLevel && dungeons.cataLevel >= this.client.config.requirements.topMinus.cata) {
            meetsCata = true
        }
        if (!dungeons.cataLevel) {
            meetsCata = true
        }
        if (this.client.config.requirements.topMinus.secrets !== null && dungeons.secrets >= this.client.config.requirements.topMinus.secrets) {
            meetsSecrets = true
        }
        if (this.client.config.requirements.topMinus.bloodMobs !== null && dungeons.bloodMobs >= this.client.config.requirements.topMinus.bloodMobs) {
            meetsBloodMobs = true
        }
        if (this.client.config.requirements.topMinus.floorSeven && dungeons.floorSeven && dungeons.floorSeven <= this.client.config.requirements.topMinus.floorSeven * 1000) {
            meetsFloorSeven = true
        }
        if (this.client.config.requirements.topMinus.masterFive && dungeons.masterFive && dungeons.masterFive <= this.client.config.requirements.topMinus.masterFive * 1000) {
            meetsMasterFive = true
        }
        if (this.client.config.requirements.topMinus.masterSix && dungeons.masterSix && dungeons.masterSix <= this.client.config.requirements.topMinus.masterSix * 1000) {
            meetsMasterSix = true
        }
        if (this.client.config.requirements.topMinus.masterSeven && dungeons.masterSeven && dungeons.masterSeven <= this.client.config.requirements.topMinus.masterSeven * 1000) {
            meetsMasterSeven = true
        }

        return meetsCata && (meetsSecrets || meetsBloodMobs) && (meetsFloorSeven || meetsMasterFive || meetsMasterSix || meetsMasterSeven)
    }

    meetsSpeedrunnerReqs(dungeons: VerifyDungeonData) {
        let meetsMasterFive = false
        let meetsMasterSix = false
        let meetsMasterSeven = false

        if (this.client.config.requirements.speedrunner.masterFive && dungeons.masterFive && dungeons.masterFive <= this.client.config.requirements.speedrunner.masterFive * 1000) {
            meetsMasterFive = true
        }
        if (this.client.config.requirements.speedrunner.masterSix && dungeons.masterSix && dungeons.masterSix <= this.client.config.requirements.speedrunner.masterSix * 1000) {
            meetsMasterSix = true
        }
        if (this.client.config.requirements.speedrunner.masterSeven && dungeons.masterSeven && dungeons.masterSeven <= this.client.config.requirements.speedrunner.masterSeven * 1000) {
            meetsMasterSeven = true
        }

        return ( meetsMasterFive || meetsMasterSix || meetsMasterSeven)
    }

    meetsSecretDuperReqs(dungeons: VerifyDungeonData) {
        return this.client.config.requirements.secretDuper.secrets !== null && dungeons.secrets >= this.client.config.requirements.secretDuper.secrets;

    }
}

export default new VerificationManager(client)