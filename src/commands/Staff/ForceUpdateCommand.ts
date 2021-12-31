import BaseCommand from "../BaseCommand";
import { client, DungeonGang } from "../../index";
import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction, GuildMemberRoleManager, MessageEmbed } from "discord.js";
import {
    cataLevel as convertXp, ephemeralMessage,
    errorEmbed, fmtMSS,
    getMojang,
    getMojangFromUuid,
    highestCataProfile
} from "../../util/Functions";
import { MongoUser } from "../../util/Mongo";
import { userSchema } from "../../util/Schema";
import EmojiManager from "../../util/EmojiManager";

module.exports = class ForceUpdateCommand extends BaseCommand {
    constructor(client: DungeonGang) {
        super(client, {
            name: "forceupdate",
            description: "Forces a user to update.",
            category: "Staff",
            usage: "forceupdate <user>",
            guildOnly: true,
            permLevel: 2,
            slashCommandBody: new SlashCommandBuilder()
                .setName("forceupdate")
                .setDescription("Forces a user to update.")
                .addUserOption(option => option
                    .setName("user")
                    .setRequired(true)
                    .setDescription("The user to force update.")
                )
        });
    }
    async execute(interaction: CommandInteraction) {
        await interaction.deferReply({
            ephemeral: ephemeralMessage(interaction.channelId)
        })
        const user = interaction.options.getUser("user", true);

        const member = await this.fetchMember(user.id, interaction.guild!)
        if (!member) {
            return interaction.editReply({
                embeds: [errorEmbed("That user is not in this server.")]
            });
        }

        let mongoUser = await this.client.mongo.getUserByDiscord(user.id) as MongoUser | undefined;

        let mojang;

        if (!mongoUser) {
            let username;
            try {
                username = member.displayName.split(" ")[1].replace(/\W/g, '')
            } catch (error) {
                return interaction.editReply({
                    embeds: [
                        errorEmbed(`Failed to get username for ${member.toString()} from nickname. This user is also not in the database. Please use /forceverify instead.`)
                    ]
                })
            }

            mojang = await getMojang(username);

            if (mojang === "error" || !mojang) {
                return interaction.editReply({
                    embeds: [
                        errorEmbed(`Could not find user \`${username}\`. This user is also not in the database. Please use /forceverify instead.`)
                    ]
                })
            }
        } else {
            mojang = await getMojangFromUuid(mongoUser.uuid);
            if (mojang === "error" || !mojang) {
                return interaction.editReply({
                    embeds: [
                        errorEmbed(`An error occured while fetching the user's UUID. Please use /forceverify instead.`)
                    ]
                })
            }
        }

        let discord;
        let player;
        try {
            player = await this.hypixel.player.uuid(mojang.id);
            discord = player.socialMedia?.links?.DISCORD ?? player.socialMedia?.DISCORD;
        } catch (error: any) {
            console.error(error);
            return interaction.editReply({
                embeds: [
                    errorEmbed("There was an error while accessing the Hypixel API: " + error.message),
                ],
            });
        }

        if (!discord) {
            return interaction.editReply({
                embeds: [
                    errorEmbed(
                        `There is no linked discord on Hypixel for the account \`${mojang.name}\`. Please use /forceverify instead.`
                    ),
                ],
            });
        }

        if (discord !== member.user.tag) {
            return interaction.editReply({
                embeds: [
                    errorEmbed(
                        `The minecraft account \`${mojang.name}\`is linked to a different discord account on Hypixel. \n\nTheir Tag: ${member.user.tag}\nHypixel Tag: ${discord}\n\nPlease use /forceverify instead.`
                    ),
                ],
            });
        }

        if (!mongoUser) {
            await this.mongo.addUser(userSchema(member.id, mojang.id));
            mongoUser = await this.mongo.getUser(mojang.id) as MongoUser | undefined;
        } else {
            if (mongoUser.discordId && mongoUser.discordId !== member.id && mongoUser.discordId !== null) {
                const otherMember = await this.fetchMember(mongoUser.discordId, member.guild);
                if (otherMember) {
                    return interaction.editReply({
                        embeds: [
                            errorEmbed(`The minecraft account \`${mojang.name}\` is linked to a different discord account on this server (${otherMember.toString()}). Please use /forceverify instead.`),
                        ]
                    })
                } else {
                    mongoUser.discordId = member.id;
                }
            } else {
                mongoUser.discordId = member.id;
            }
        }

        let roles = member.roles as GuildMemberRoleManager
        let rolesArray = this.arrayRoleIds(roles)

        let profile;
        try {
            profile = highestCataProfile(await this.hypixel.skyblock.profiles.uuid(mojang.id), mojang.id)
        } catch (error: any) {
            if (error.message === 'Key "profiles" is not an array.') {
                profile = undefined
            } else {
                console.error(error);
                return interaction.editReply({
                    embeds: [
                        errorEmbed("There was an error while accessing the Hypixel API: " + error.message),
                    ],
                });
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
                cataLevel: Math.floor(convertXp(profile.members[mojang.id].dungeons?.dungeon_types.catacombs.experience ?? 0)),
                secrets: player.achievements?.skyblock_treasure_hunter ?? 0,
                bloodMobs: (profile.members[mojang.id].stats.kills_watcher_summon_undead ?? 0) + (profile.members[mojang.id].stats.kills_watcher_summon_skeleton ?? 0) + (profile.members[mojang.id].stats.kills_master_watcher_summon_undead ?? 0),
                floorSeven: profile.members[mojang.id].dungeons?.dungeon_types.catacombs.fastest_time_s_plus?.[7] ?? undefined,
                masterFive: profile.members[mojang.id].dungeons?.dungeon_types.master_catacombs?.fastest_time_s_plus?.[5] ?? undefined,
                masterSix: profile.members[mojang.id].dungeons?.dungeon_types.master_catacombs?.fastest_time_s_plus?.[6] ?? undefined
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


        if (mongoUser) {
            await this.mongo.updateUser(mongoUser);
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

        await member.edit({
            nick: member.manageable ? nickname : undefined,
            roles: rolesArray,
        }, `Force verified as ${mojang.name} by ${interaction.user.tag}`)

        const stats = "Catacombs Level: " + dungeons.cataLevel
            + "\nSecrets: " + dungeons.secrets
            + "\nBlood Mob Kills: " + dungeons.bloodMobs
            + "\nFloor 7 S+: " + (dungeons.floorSeven ? fmtMSS(dungeons.floorSeven!) : "N/A")
            + "\nMaster Five S+: " + (dungeons.masterFive ? fmtMSS(dungeons.masterFive!) : "N/A")
            + "\nMaster Six S+: " + (dungeons.masterSix ? fmtMSS(dungeons.masterSix!) : "N/A")

        return interaction.editReply({
            embeds: [
                new MessageEmbed()
                    .setTitle(`Force Updated!`)
                    .setDescription(`Successfully force updated <@${member.user.id}> as \`${mojang.name}\`!`)
                    .addField("**Stats Overview**", stats)
                    .setFooter(client.user?.username as string, client.user?.avatarURL()?.toString())
                    .setColor("#B5FF59")
                    .setTimestamp()
            ]
        })

    }
}