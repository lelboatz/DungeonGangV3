import BaseCommand from "../BaseCommand";
import { client, DungeonGang } from "../../index";
import { SlashCommandBuilder } from "@discordjs/builders";
import {
    Collection,
    CommandInteraction,
    Guild,
    GuildBasedChannel,
    GuildMember,
    GuildMemberRoleManager, MessageEmbed,
    Role,
    TextChannel
} from "discord.js";
import {
    cataLevel as convertXp,
    embed,
    ephemeralMessage,
    errorEmbed, fmtMSS,
    getMojang,
    highestCataProfile
} from "../../util/Functions";
import { MongoUser } from "../../util/Mongo";
import { userSchema } from "../../util/Schema";

module.exports = class ScanCommand extends BaseCommand {
    constructor(client: DungeonGang) {
        super(client, {
            name: "scan",
            description: "Scans a role for members and adds them to the database.",
            category: "Staff",
            usage: "scan <role>",
            guildOnly: true,
            permLevel: 1,
            slashCommandBody: new SlashCommandBuilder()
                .setName("scan")
                .setDescription("Scans a role for members and adds them to the database.")
                .addRoleOption(option => option
                    .setName("role")
                    .setDescription("The role to scan.")
                    .setRequired(true)
                )
                .addChannelOption(option => option
                    .setName("channel")
                    .setDescription("The channel to send the results to.")
                    .setRequired(false)
                )
        })
    }
    async execute(interaction: CommandInteraction) {
        await interaction.deferReply({
            ephemeral: ephemeralMessage(interaction.channelId)
        })

        const role = interaction.options.getRole("role", true) as Role
        const channel = interaction.options.getChannel("channel")
        const guild = interaction.guild as Guild
        let bypassDiscord = false;

        if (channel && channel.type !== "GUILD_TEXT") {
            return interaction.editReply({
                embeds: [
                    errorEmbed(`The channel must be a text channel.`)
                ]
            })
        }

        let members = await guild.members.fetch()
        members = members.filter(member => member.roles.cache.has(role.id))

        if (members.size === 0) {
            return interaction.editReply({
                embeds: [
                    errorEmbed(`No members found in ${role.toString()}.`)
                ]
            })
        }

        await interaction.editReply({
            embeds: [
                embed("Scanning...", `Found ${members.size} members in the role <@&${role.id}>. ${(channel) ? `Sending results to ${channel.toString()}` : ""}`)
            ]
        })

        return this.scan(members, channel ?? undefined)

    }

    async scan(members: Collection<string, GuildMember>, channel?: TextChannel) {
        for (const [, member] of members) {
            let username;
            let bypassDiscord = false;

            try {
                username = member.displayName.split(" ")[1].replace(/\W/g, '')
            } catch (error) {
                await channel?.send({
                    embeds: [
                        errorEmbed(`Failed to get username for ${member.toString()}.`)
                    ]
                })
                continue;
            }

            const mojang = await getMojang(username)

            if (!mojang || mojang === "error") {
                await channel?.send({
                    embeds: [
                        errorEmbed(`Failed to get username for ${member.toString()}.`)
                    ]
                })
                continue;
            }

            let discord;
            let player;
            try {
                player = await this.hypixel.player.uuid(mojang.id);
                discord = player.socialMedia?.links.DISCORD ?? player.socialMedia?.DISCORD;
            } catch (error: any) {
                console.error(error);
                await channel?.send({
                    embeds: [
                        errorEmbed(`There was a Hypixel API error while trying to scan ${member.toString()} (${mojang.name}): ${error.message}`)
                    ],
                });
                continue;
            }

            if (!discord && !bypassDiscord) {
                channel?.send({
                    embeds: [
                        errorEmbed(
                            `There is no linked discord on Hypixel for ${member.toString()} (${mojang.name}). Skipping this member.`
                        ),
                    ],
                });
                continue;
            }

            if (discord !== member.user.tag && !bypassDiscord) {
                channel?.send({
                    embeds: [
                        errorEmbed(
                            `The minecraft account for ${member.toString()} (${mojang.name}) is linked to a different discord account on Hypixel. \n\nTheir Tag: ${member.user.tag}\nHypixel Tag: ${discord}\n\nSkipping this member.`
                        ),
                    ],
                });
                continue;
            }

            let mcUser = await this.mongo.getUserByUuid(mojang.id) as MongoUser | undefined | null

            if (mcUser) {
                if (mcUser._id !== member.id) {
                    const otherMember = await this.fetchMember(mcUser._id, member.guild)
                    if (otherMember) {
                        channel?.send({
                            embeds: [
                                errorEmbed(
                                    `The minecraft account \`${mojang.name}\` is linked to a different discord account on this server. Skipping this member.`,
                                ),
                            ],
                        });
                        continue;
                    } else {
                        await this.mongo.deleteUserByUuid(mojang.id)
                    }
                }
            }

            let mongoUser = await this.mongo.getUserByDiscord(member.user.id) as MongoUser | undefined | null

            if (!mongoUser) {
                mongoUser = userSchema(member.user.id, mojang.id)
                this.mongo.addUser(mongoUser)
            } else {
                this.mongo.updateUser(mongoUser)
            }

            let roles = member.roles as GuildMemberRoleManager
            let rolesArray = this.arrayRoleIds(roles)

            let profile;
            try {
                profile = highestCataProfile(await this.hypixel.skyblock.profiles.uuid(mojang.id), mojang.id)
            } catch (error: any) {
                console.error(error);
                channel?.send({
                    embeds: [
                        errorEmbed(`There was a Hypixel API error while trying to scan ${member.toString()} (${mojang.name}): ${error.message}`)
                    ],
                });
                continue;
            }

            let dungeons;

            if (!profile) {
                dungeons = {
                    cataLevel: 0,
                    secrets: player.achievements.skyblock_treasure_hunter ?? 0,
                    bloodMobs: 0,
                    floorSeven: undefined,
                    masterFive: undefined,
                    masterSix: undefined
                }
            } else {
                dungeons = {
                    cataLevel: Math.floor(convertXp(profile.members[mojang.id].dungeons?.dungeon_types.catacombs.experience!)),
                    secrets: player.achievements.skyblock_treasure_hunter ?? 0,
                    bloodMobs: (profile.members[mojang.id].stats.kills_watcher_summon_undead ?? 0) + (profile.members[mojang.id].stats.kills_watcher_summon_skeleton ?? 0) + (profile.members[mojang.id].stats.kills_master_watcher_summon_undead ?? 0),
                    floorSeven: profile.members[mojang.id].dungeons?.dungeon_types.catacombs.fastest_time_s_plus?.[7] ?? undefined,
                    masterFive: profile.members[mojang.id].dungeons?.dungeon_types.master_catacombs.fastest_time_s_plus?.[5] ?? undefined,
                    masterSix: profile.members[mojang.id].dungeons?.dungeon_types.master_catacombs.fastest_time_s_plus?.[6] ?? undefined
                }
            }

            let tpp = false, tp = false, tpm = false, speedrunner = false;

            if ((dungeons.secrets >= 20000 || dungeons.bloodMobs >= 45000) && dungeons.cataLevel >= 48 && dungeons.masterSix) {
                if (dungeons.masterSix <= 195000 && !member.roles.cache.has(this.client.config.discord.roles.topPlayer.votedOut)) {
                    tpp = true;
                }
            }

            if (member.roles.cache.has(this.client.config.discord.roles.topPlayer.plusReq)) {
                tpp = true;
            }

            if (!tpp && dungeons.cataLevel >= 45 && dungeons.secrets > 30000 && (dungeons.floorSeven || dungeons.masterFive || dungeons.masterSix)) {
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

            if ((!tp && !tpp) && dungeons.cataLevel >= 42 && dungeons.secrets > 20000 && (dungeons.floorSeven || dungeons.masterFive)) {
                if (dungeons.floorSeven && dungeons.floorSeven <= 260000) {
                    tpm = true;
                }
                if (dungeons.masterFive && dungeons.masterFive <= 165000) {
                    tpm = true;
                }
            }

            if (dungeons.masterSix) {
                if (dungeons.masterSix <= 300000) {
                    speedrunner = true;
                }
            }

            for (const [, value] of Object.entries(this.client.config.discord.roles.cata)) {
                if (rolesArray.includes(value)) {
                    rolesArray.splice(rolesArray.indexOf(value), 1)
                }
            }

            if (rolesArray.includes(this.client.config.discord.roles.topPlayer.plus)) {
                rolesArray.splice(rolesArray.indexOf(this.client.config.discord.roles.topPlayer.plus), 1)
            } else if (rolesArray.includes(this.client.config.discord.roles.topPlayer.normal)) {
                rolesArray.splice(rolesArray.indexOf(this.client.config.discord.roles.topPlayer.normal), 1)
            } else if (rolesArray.includes(this.client.config.discord.roles.topPlayer.minus)) {
                rolesArray.splice(rolesArray.indexOf(this.client.config.discord.roles.topPlayer.minus), 1)
            }

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

            if (dungeons.cataLevel < 30 || dungeons.cataLevel > 60) {

            } else if (dungeons.cataLevel >= 30 && dungeons.cataLevel <= 34) {
                rolesArray.push(this.client.config.discord.roles.cata["30"])
            } else if (dungeons.cataLevel >= 35 && dungeons.cataLevel <= 39) {
                rolesArray.push(this.client.config.discord.roles.cata["35"])
            } else {
                if (!tpp && !tp && !tpm) {
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

            let emojis = "";

            try {
                emojis = member.displayName.split(" ")[2]
            } catch (error: any) {

            }

            let nickname = `❮${dungeons.cataLevel}❯ ${mojang.name} ${emojis}`;
            if (symbol) nickname = nickname.replace(/[❮❯]/g, symbol)

            if (!rolesArray.includes(this.client.config.discord.roles.member)) {
                rolesArray.push(this.client.config.discord.roles.member)
            }

            await member.edit({
                nick: member.manageable ? nickname : undefined,
                roles: rolesArray,
            }, `Bulk Scan: Force verified as ${mojang.name}`)

            const stats = "Catacombs Level: " + dungeons.cataLevel
                + "\nSecrets: " + dungeons.secrets
                + "\nBlood Mob Kills: " + dungeons.bloodMobs
                + "\nFloor 7 S+: " + (dungeons.floorSeven ? fmtMSS(dungeons.floorSeven!) : "N/A")
                + "\nMaster Five S+: " + (dungeons.masterFive ? fmtMSS(dungeons.masterFive!) : "N/A")
                + "\nMaster Six S+: " + (dungeons.masterSix ? fmtMSS(dungeons.masterSix!) : "N/A")

            channel?.send({
                embeds: [
                    new MessageEmbed()
                        .setTitle(`Member Scan: Force Verified!`)
                        .setDescription(`Successfully force verified <@${member.user.id}> as \`${mojang.name}\`!`)
                        .addField("**Stats Overview**", stats)
                        .setFooter(client.user?.username as string, client.user?.avatarURL()?.toString())
                        .setColor("#05e318")
                        .setTimestamp()
                ]
            })
        }
    }
}