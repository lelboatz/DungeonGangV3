import BaseCommand from "../BaseCommand";
import { client, DungeonGang } from "../../index";
import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction, GuildMember, GuildMemberRoleManager, MessageEmbed } from "discord.js";
import { cataLevel, embed, errorEmbed, fmtMSS, getMojang, highestCataProfile } from "../../util/Functions";
import { userSchema } from "../../util/Schema";
import { MongoUser } from "../../util/Mongo";
import EmojiManager from "../../util/EmojiManager";

module.exports = class VerifyCommand extends BaseCommand {
    constructor(client: DungeonGang) {
        super(client,{
            name: "verify",
            category: "Hypixel",
            description: "Verify a user.",
            usage: "verify <user>",
            guildOnly: true,
            permLevel: 0,
            slashCommandBody: new SlashCommandBuilder()
                .setName("verify")
                .setDescription("Verify as a user")
                .addStringOption(option => option
                    .setName("username")
                    .setRequired(true)
                    .setDescription("Your minecraft username")
                )
        });
    }

    async execute(interaction: CommandInteraction) {
        await interaction.deferReply({
            ephemeral: true
        })

        if (!this.client.config.discord.verifyChannels.includes(interaction.channelId)) {
            return interaction.editReply({
                embeds: [
                    errorEmbed("You can only use this command in a verification channel.")
                ]
            })
        }

        const username = interaction.options.getString("username", true);
        const mojang = await getMojang(username);
        if (mojang === "error" || !mojang) {
            return interaction.editReply({
                embeds: [
                    errorEmbed(`Could not find user \`${username}\`.`)
                ]
            })
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
                        `There is no linked discord on Hypixel for the account \`${mojang.name}\`, please refer to the gif below for help with linking your discord account.`,
                        true
                    ),
                ],
            });
        }

        if (discord !== interaction.user.tag) {
            return interaction.editReply({
                embeds: [
                    errorEmbed(
                        `The minecraft account \`${mojang.name}\`is linked to a different discord account on Hypixel. \n\nYour Tag: ${interaction.user.tag}\nHypixel Tag: ${discord}\n\nPlease see the gif below if you need help with linking your discord account.`,
                        true
                    ),
                ],
            });
        }

        let user = await this.mongo.getUser(mojang.id) as MongoUser | null | undefined;

        if (!user) {
            await this.mongo.addUser(userSchema(interaction.user.id, mojang.id));
            user = await this.mongo.getUser(mojang.id) as MongoUser | undefined;
        } else {
            if (user.discordId && user.discordId !== interaction.user.id && user.discordId !== null) {
                const otherMember = await this.fetchMember(user.discordId, interaction.guild!);
                if (otherMember) {
                    return interaction.editReply({
                        embeds: [
                            errorEmbed(`The minecraft account \`${mojang.name}\` is linked to a different discord account on this server. Please leave the server on your other account (${otherMember.toString()}) and try again.`)
                        ]
                    })
                } else {
                    user.discordId = interaction.user.id;
                }
            } else {
                user.discordId = interaction.user.id;
            }
        }

        let roles = interaction.member?.roles as GuildMemberRoleManager
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
                cataLevel: Math.floor(cataLevel(profile.members[mojang.id].dungeons?.dungeon_types.catacombs.experience ?? 0)),
                secrets: player.achievements?.skyblock_treasure_hunter ?? 0,
                bloodMobs: (profile.members[mojang.id].stats.kills_watcher_summon_undead ?? 0) + (profile.members[mojang.id].stats.kills_watcher_summon_skeleton ?? 0) + (profile.members[mojang.id].stats.kills_master_watcher_summon_undead ?? 0),
                floorSeven: profile.members[mojang.id].dungeons?.dungeon_types.catacombs.fastest_time_s_plus?.[7] ?? undefined,
                masterFive: profile.members[mojang.id].dungeons?.dungeon_types.master_catacombs?.fastest_time_s_plus?.[5] ?? undefined,
                masterSix: profile.members[mojang.id].dungeons?.dungeon_types.master_catacombs?.fastest_time_s_plus?.[6] ?? undefined
            }
        }

        let member = interaction.member as GuildMember;

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
            await this.mongo.updateUser(user)
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
        }, `Verified as ${mojang.name}`)

        const stats = "Catacombs Level: " + dungeons.cataLevel
        + "\nSecrets: " + dungeons.secrets
        + "\nBlood Mob Kills: " + dungeons.bloodMobs
        + "\nFloor 7 S+: " + (dungeons.floorSeven ? fmtMSS(dungeons.floorSeven!) : "N/A")
        + "\nMaster Five S+: " + (dungeons.masterFive ? fmtMSS(dungeons.masterFive!) : "N/A")
        + "\nMaster Six S+: " + (dungeons.masterSix ? fmtMSS(dungeons.masterSix!) : "N/A")

        return interaction.editReply({
            embeds: [
                new MessageEmbed()
                    .setTitle(`Verified!`)
                    .setDescription(`Successfully verified as \`${mojang.name}\`!`)
                    .addField("**Stats Overview**", stats)
                    .setFooter(client.user?.username as string, client.user?.avatarURL()?.toString())
                    .setColor("#B5FF59")
                    .setTimestamp()
            ]
        })

    }
}