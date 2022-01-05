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
                masterSix: undefined
            }
        } else {
            dungeons = {
                cataLevel: Math.floor(cataLevel(profile.members[mojang.id].dungeons?.dungeon_types.catacombs.experience ?? 0)),
                secrets: player.achievements?.skyblock_treasure_hunter ?? 0,
                bloodMobs: (profile.members[mojang.id].stats.kills_watcher_summon_undead ?? 0) + (profile.members[mojang.id].stats.kills_watcher_summon_skeleton ?? 0) + (profile.members[mojang.id].stats.kills_master_watcher_summon_undead ?? 0),
                floorSeven: profile.members[mojang.id].dungeons?.dungeon_types.catacombs.fastest_time_s_plus?.[7] ?? undefined,
                masterFive: profile.members[mojang.id].dungeons?.dungeon_types.master_catacombs?.fastest_time_s_plus?.[5] ?? undefined,
                masterSix: profile.members[mojang.id].dungeons?.dungeon_types.master_catacombs?.fastest_time_s_plus?.[6] ?? undefined
            }
        }

        if (member.roles.cache.has(this.client.config.discord.roles.topPlayer.votedOut)) {
            if (user) {
                user.votedOut = true;
            }
        }

        if (member.roles.cache.has(this.client.config.discord.roles.topPlayer.plusReq)) {
            if (user) {
                user.votedIn = true;
            }
        }

        if (user) {
            await this.client.mongo.updateUser(user)
        }

        let tpp = false, tp = false, tpm = false, speedrunner = false, secretDuper = false;

        if ((dungeons.secrets >= 50000 || dungeons.bloodMobs >= 45000) && dungeons.cataLevel >= 48 && dungeons.masterSix) {
            if (dungeons.masterSix <= 195000 && !member.roles.cache.has(this.client.config.discord.roles.topPlayer.votedOut)) {
                tpp = true;
            }
        }

        if (member.roles.cache.has(this.client.config.discord.roles.topPlayer.plusReq)) {
            tpp = true;
        }

        if (!tpp && dungeons.cataLevel >= 45 && dungeons.secrets >= 30000 && (dungeons.floorSeven || dungeons.masterFive || dungeons.masterSix)) {
            if (dungeons.floorSeven && dungeons.floorSeven <= 225000) {
                tp = true;
            }
            if (dungeons.masterFive && dungeons.masterFive <= 150000) {
                tp = true;
            }
            if (dungeons.masterSix && dungeons.masterSix <= 225000) {
                tp = true;
            }
        }

        if ((!tp && !tpp) && dungeons.cataLevel >= 42 && dungeons.secrets >= 20000 && (dungeons.floorSeven || dungeons.masterFive)) {
            if (dungeons.floorSeven && dungeons.floorSeven <= 260000) {
                tpm = true;
            }
            if (dungeons.masterFive && dungeons.masterFive <= 165000) {
                tpm = true;
            }
        }

        if (tpp) tp = true;

        if (dungeons.masterSix) {
            if (dungeons.masterSix <= 170000) {
                speedrunner = true;
            }
        }

        if (dungeons.secrets >= 100000) {
            secretDuper = true;
        }

        // Removing Roles from Array

        for (const [, value] of Object.entries(this.client.config.discord.roles.cata)) {
            if (rolesArray.includes(value)) {
                rolesArray.splice(rolesArray.indexOf(value), 1)
            }
        }

        if (rolesArray.includes(this.client.config.discord.roles.topPlayer.plus)) {
            rolesArray.splice(rolesArray.indexOf(this.client.config.discord.roles.topPlayer.plus), 1)
        }

        if (rolesArray.includes(this.client.config.discord.roles.topPlayer.normal)) {
            rolesArray.splice(rolesArray.indexOf(this.client.config.discord.roles.topPlayer.normal), 1)
        }

        if (rolesArray.includes(this.client.config.discord.roles.topPlayer.minus)) {
            rolesArray.splice(rolesArray.indexOf(this.client.config.discord.roles.topPlayer.minus), 1)
        }

        if (rolesArray.includes(this.client.config.discord.roles.misc.speedRunner)) {
            rolesArray.splice(rolesArray.indexOf(this.client.config.discord.roles.misc.speedRunner), 1)
        }

        if (rolesArray.includes(this.client.config.discord.roles.misc.secretDuper)) {
            rolesArray.splice(rolesArray.indexOf(this.client.config.discord.roles.misc.secretDuper), 1)
        }

        // Adding Roles to Array

        if (tpp && !rolesArray.includes(this.client.config.discord.roles.topPlayer.plus)) {
            rolesArray.push(this.client.config.discord.roles.topPlayer.plus)
        }

        if (tp && !rolesArray.includes(this.client.config.discord.roles.topPlayer.normal)) {
            rolesArray.push(this.client.config.discord.roles.topPlayer.normal)
        }

        if (tpm && !rolesArray.includes(this.client.config.discord.roles.topPlayer.minus)) {
            rolesArray.push(this.client.config.discord.roles.topPlayer.minus)
        }

        if (speedrunner && !rolesArray.includes(this.client.config.discord.roles.misc.speedRunner)) {
            rolesArray.push(this.client.config.discord.roles.misc.speedRunner)
        }

        if (secretDuper && !rolesArray.includes(this.client.config.discord.roles.misc.secretDuper)) {
            rolesArray.push(this.client.config.discord.roles.misc.secretDuper)
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
}

export default new VerificationManager(client)