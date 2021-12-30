import BaseCommand from "../BaseCommand";
import { DungeonGang } from "../../index";
import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import {
    cataExp,
    cataLevel,
    cataXp,
    ephemeralMessage,
    errorEmbed,
    getMojang,
    highestCataProfile
} from "../../util/Functions";

module.exports = class CalcCommand extends BaseCommand {
    constructor(client: DungeonGang) {
        super(client, {
            name: "calc",
            category: "Hypixel",
            usage: "calc <start level or player> <end level or player>",
            description: "Calculates the amount of catacombs experience you need to reach a certain level.",
            guildOnly: true,
            permLevel: 0,
            slashCommandBody: new SlashCommandBuilder()
                .setName("calc")
                .setDescription("Calculates the amount of catacombs experience you need to reach a certain level.")
                .addStringOption(option => option
                    .setName("start_level_or_player")
                    .setRequired(true)
                    .setDescription("The level or player you want to start at.")
                )
                .addStringOption(option => option
                    .setName("end_level_or_player")
                    .setRequired(true)
                    .setDescription("The level or player you want to end at.")
                )
        })
    }
    async execute(interaction: CommandInteraction) {
        await interaction.deferReply({
            ephemeral: ephemeralMessage(interaction.channelId)
        })

        const startLevelOrPlayer = interaction.options.getString("start_level_or_player", true);
        const endLevelOrPlayer = interaction.options.getString("end_level_or_player", true);

        let start, end;

        let startUsername, endUsername;

        if (!isNaN(parseFloat(startLevelOrPlayer))) {
            if (parseFloat(startLevelOrPlayer) < 0 || parseFloat(startLevelOrPlayer) > 60) {
                start = startLevelOrPlayer;
            } else {
                start = cataExp(parseFloat(startLevelOrPlayer));
            }
        } else {
            start = startLevelOrPlayer;
        }

        if (!isNaN(parseFloat(endLevelOrPlayer))) {
            if (parseFloat(endLevelOrPlayer) < 0 || parseFloat(endLevelOrPlayer) > 60) {
                end = endLevelOrPlayer;
            } else {
                end = cataExp(parseFloat(endLevelOrPlayer));
            }
        } else {
            end = endLevelOrPlayer
        }

        if (typeof(start) === "string") {
            const mojang = await getMojang(start);
            if (mojang === "error" || !mojang) {
                return interaction.editReply({
                    embeds: [
                        errorEmbed(`Could not find user \`${start}\`.`)
                    ]
                })
            }

            startUsername = mojang.name;

            let profiles;
            try {
                profiles = await this.hypixel.skyblock.profiles.uuid(mojang.id);
            } catch (error: any) {
                console.error(error);
                return interaction.editReply({
                    embeds: [
                        errorEmbed("There was an error while accessing the Hypixel API: " + error.message),
                    ],
                });
            }

            let profile = highestCataProfile(profiles, mojang.id);

            if (!profile) {
                start = 0;
            } else {
                start = profile.members[mojang.id].dungeons?.dungeon_types.catacombs.experience ?? 0
            }
        }

        if (typeof(end) === "string") {
            const mojang = await getMojang(end);
            if (mojang === "error" || !mojang) {
                return interaction.editReply({
                    embeds: [
                        errorEmbed(`Could not find user \`${end}\`.`)
                    ]
                })
            }

            endUsername = mojang.name;

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

            if (!profile) {
                end = 0;
            } else {
                end = profile.members[mojang.id].dungeons?.dungeon_types.catacombs.experience ?? 0
            }
        }

        // if (start > end) {
        //     return interaction.editReply({
        //         embeds: [
        //             errorEmbed("The start level cannot be higher than the end level.")
        //         ]
        //     })
        // }

        const startLevel = cataLevel(start), endLevel = cataLevel(end);

        const requiredExp = Math.abs(end - start);

        return interaction.editReply({
            embeds: [
                {
                    title: `Catacombs XP Calculator`,
                    color: "#B5FF59",
                    description: `Level **${startLevel.toFixed(2)}** to Level **${endLevel.toFixed(2)}**`,
                    fields: [
                        {
                            name: "Required Experience",
                            value: `**${this.formatter.format(requiredExp)}** catacombs experience required to go from ${startUsername ? (`${startUsername} (level **${startLevel.toFixed(2)}**)`) : (`level **${startLevel.toFixed(2)}**`)} to ${endUsername ? (`${endUsername} (level **${endLevel.toFixed(2)})**`) : (`level **${endLevel.toFixed(2)}**`)}.`,
                            inline: true
                        }
                    ]
                }
            ]
        })
    }
}