import BaseCommand from "../BaseCommand";
import { DungeonGang } from "../../index";
import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction, MessageEmbed } from "discord.js";
import { cataLevel, ephemeralMessage, errorEmbed, fmtMSS, getMojang, highestCataProfile, cataXp as cataLevels } from "../../util/Functions";

module.exports = class CataCommand extends BaseCommand {
    constructor(client: DungeonGang) {
        super(client, {
            name: "cata",
            category: "Hypixel",
            usage: "cata <user>",
            description: "Shows the Catacombs stats of a user.",
            guildOnly: true,
            permLevel: 0,
            slashCommandBody: new SlashCommandBuilder()
                .setName("cata")
                .setDescription("Shows the Catacombs stats of a user.")
                .addStringOption(option => option
                    .setName("username")
                    .setDescription("The minecraft username of the user.")
                    .setRequired(true)
                )
        })
    }
    async execute(interaction: CommandInteraction) {
        await interaction.deferReply({
            ephemeral: ephemeralMessage(interaction.channelId)
        })

        const username = interaction.options.getString("username", true)
        const mojang = await getMojang(username)

        if (mojang === "error" || !mojang) {
            return interaction.editReply({
                embeds: [
                    errorEmbed(`Could not find user \`${username}\`.`)
                ]
            })
        }

        let player;
        let profile;
        try {
            player = await this.hypixel.player.uuid(mojang.id);
            profile = highestCataProfile(await this.hypixel.skyblock.profiles.uuid(mojang.id), mojang.id)
        } catch (error: any) {
            if (error.message === 'Key "profiles" is not an array.' && player) {
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
                cataXp: 0,
                secrets: player.achievements.skyblock_treasure_hunter ?? 0,
                bloodMobs: 0,
                floorSeven: undefined,
                masterFour: undefined,
                masterFive: undefined,
                masterSix: undefined,
                floorSevenCompletions: 0,
                masterFourCompletions: 0,
                masterFiveCompletions: 0,
                masterSixCompletions: 0
            }
        } else {
            dungeons = {
                cataLevel: cataLevel(profile.members[mojang.id].dungeons?.dungeon_types.catacombs.experience ?? 0).toFixed(2),
                cataXp: profile.members[mojang.id].dungeons?.dungeon_types.catacombs.experience ?? 0,
                secrets: player.achievements.skyblock_treasure_hunter ?? 0,
                bloodMobs: (profile.members[mojang.id].stats.kills_watcher_summon_undead ?? 0) + (profile.members[mojang.id].stats.kills_watcher_summon_skeleton ?? 0) + (profile.members[mojang.id].stats.kills_master_watcher_summon_undead ?? 0),
                floorSeven: profile.members[mojang.id].dungeons?.dungeon_types.catacombs.fastest_time_s_plus?.[7] ?? undefined,
                masterFour: profile.members[mojang.id].dungeons?.dungeon_types.master_catacombs.fastest_time_s?.[4] ?? undefined,
                masterFive: profile.members[mojang.id].dungeons?.dungeon_types.master_catacombs.fastest_time_s_plus?.[5] ?? undefined,
                masterSix: profile.members[mojang.id].dungeons?.dungeon_types.master_catacombs.fastest_time_s_plus?.[6] ?? undefined,
                floorSevenCompletions: profile.members[mojang.id].dungeons?.dungeon_types.catacombs.tier_completions?.[7] ?? 0,
                masterFourCompletions: profile.members[mojang.id].dungeons?.dungeon_types.master_catacombs.tier_completions?.[4] ?? 0,
                masterFiveCompletions: profile.members[mojang.id].dungeons?.dungeon_types.master_catacombs.tier_completions?.[5] ?? 0,
                masterSixCompletions: profile.members[mojang.id].dungeons?.dungeon_types.master_catacombs.tier_completions?.[6] ?? 0
            }
        }
        let YES = "<:yes:811402191947694111>", NO = "<:no:819295465623388201>"


        let tpm = NO, tp = NO, tpp = NO, speedrunner = NO, votedOut = NO, plusReq = NO;

        if ((dungeons.secrets >= 50000 || dungeons.bloodMobs >= 45000) && dungeons.cataLevel >= 48 && dungeons.masterSix) {
            if (dungeons.masterSix <= 195000) {
                tpp = YES;
            }
        }

        if ((tpp === NO) && dungeons.cataLevel >= 45 && dungeons.secrets >= 30000 && (dungeons.floorSeven || dungeons.masterFive || dungeons.masterSix)) {
            if (dungeons.floorSeven && dungeons.floorSeven <= 225000) {
                tp = YES;
            }
            if (dungeons.masterFive && dungeons.masterFive <= 150000) {
                tp = YES;
            }
            if (dungeons.masterSix && dungeons.masterSix <= 225000) {
                tp = YES;
            }
        }

        if ((tp === NO && tpp === NO) && dungeons.cataLevel >= 42 && dungeons.secrets >= 20000 && (dungeons.floorSeven || dungeons.masterFive)) {
            if (dungeons.floorSeven && dungeons.floorSeven <= 260000) {
                tpm = YES;
            }
            if (dungeons.masterFive && dungeons.masterFive <= 165000) {
                tpm = YES;
            }
        }

        if (dungeons.masterSix) {
            if (dungeons.masterSix <= 180000) {
                speedrunner = YES;
            }
        }

        if (tpp === YES) tp = YES;

        return interaction.editReply({
            embeds: [
                new MessageEmbed()
                    .setAuthor({
                        name: "➤ Dungeon Data for " + mojang.name,
                        url: "https://sky.shiiyu.moe/stats/" + mojang.name,
                        iconURL: `https://crafatar.com/avatars/${mojang.id}?overlay`
                    })
                    .setThumbnail(this.client.user?.avatarURL()?.toString()!)
                    .addField("**Catacombs Level**", dungeons.cataLevel.toString() + ` [${this.formatter.format(Math.floor(dungeons.cataXp - cataLevels[Math.floor(parseFloat(dungeons.cataLevel.toString()))][1]))}/${this.formatter.format(cataLevels[Math.floor(parseFloat(dungeons.cataLevel.toString())) + 1][1] - cataLevels[Math.floor(parseFloat(dungeons.cataLevel.toString()))][1])}]`, false)
                    .addField("**Secrets**", this.formatter.format(dungeons.secrets), true)
                    .addField("**Blood Mob Kills**", this.formatter.format(dungeons.bloodMobs), true)
                    .addField("**Floor 7**", "S+ PB: " + (dungeons.floorSeven ? fmtMSS(dungeons.floorSeven) : "N/A") + "\nCompletions: " + this.formatter.format(dungeons.floorSevenCompletions), true)
                    .addField("**Master 4**", "S PB: " + (dungeons.masterFour ? fmtMSS(dungeons.masterFour) : "N/A") + "\nCompletions: " + this.formatter.format(dungeons.masterFourCompletions), true)
                    .addField("**Master 5**", "S+ PB: " + (dungeons.masterFive ? fmtMSS(dungeons.masterFive) : "N/A") + "\nCompletions: " + this.formatter.format(dungeons.masterFiveCompletions), true)
                    .addField("**Master 6**", "S+ PB: " + (dungeons.masterSix ? fmtMSS(dungeons.masterSix) : "N/A") + "\nCompletions: " + this.formatter.format(dungeons.masterSixCompletions), true)
                    .addField("**Qualifications**",
                        `<@&${this.client.config.discord.roles.topPlayer.minus}> ${tpm}\n` +
                        `<@&${this.client.config.discord.roles.topPlayer.normal}> ${tp}\n` +
                        `<@&${this.client.config.discord.roles.topPlayer.plus}> ${tpp}\n` +
                        `<@&${this.client.config.discord.roles.misc.speedRunner}> ${speedrunner}\n` +
                        `<@&${this.client.config.discord.roles.topPlayer.plusReq}> ${NO}\n` +
                        `<@&${this.client.config.discord.roles.topPlayer.votedOut}> ${NO}`, false
                    )
                    .setFooter(this.client.user?.username as string, this.client.user?.avatarURL()?.toString())
                    .setColor("#B5FF59")
            ]
        })
    }
}