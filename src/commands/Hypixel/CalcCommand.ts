import BaseCommand from "../BaseCommand";
import { DungeonGang } from "../../index";
import { ContextMenuCommandBuilder, SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction, GuildMember, MessageContextMenuInteraction, UserContextMenuInteraction } from "discord.js";
import {
    cataExp,
    cataLevel,
    ephemeralMessage,
    errorEmbed,
    getMojang,
    getMojangFromUuid,
    highestCataProfile,
    bypassWords,
    starWord
} from "../../util/Functions";
import { ApplicationCommandType } from "discord-api-types";

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
                .addStringOption(option => option
                    .setName("class")
                    .setDescription("The class that you would like to calculate xp for.")
                    .addChoices([["Mage", "mage"], ["Archer", "archer"], ["Berserk", "berserk"], ["Tank", "tank"], ["Healer", "healer"]])
                ),
            messageContextMenuCommandBody: new ContextMenuCommandBuilder()
                .setName("Exp Calculator")
                .setType(ApplicationCommandType.Message),
            userContextMenuCommandBody: new ContextMenuCommandBuilder()
                .setName("Exp Calculator")
                .setType(ApplicationCommandType.User),
        })
    }
    async execute(interaction: CommandInteraction | UserContextMenuInteraction | MessageContextMenuInteraction) {
        await interaction.deferReply({
            ephemeral: ephemeralMessage(interaction.channelId)
        })

        let startLevelOrPlayer;
        let endLevelOrPlayer;
        let className;

        if (interaction.isCommand()) {
            startLevelOrPlayer = interaction.options.getString("start_level_or_player", true);
            endLevelOrPlayer = interaction.options.getString("end_level_or_player", true);
            className = interaction.options.getString("class", false);
        } else {
            let startMember = interaction.member as GuildMember
            const startMongoUser = await this.mongo.getUserByDiscord(startMember.user.id)
            if (!startMongoUser) {
                try {
                    startLevelOrPlayer = startMember.displayName.split(" ")[1].replace(/\W/g, '')
                } catch {
                    return interaction.editReply({
                        embeds: [
                            errorEmbed(`Failed to get username for ${startMember.toString()} from nickname. This user is also not in the database.`)
                        ]
                    })
                }
            } else {
                let mojang = await getMojangFromUuid(startMongoUser.uuid)
                if (mojang === "error" || !mojang) {
                    return interaction.editReply({
                        embeds: [
                            errorEmbed(`Unable to get Mojang data for ${startMember.toString()} from the database or nickname.`)
                        ]
                    })
                }
                startLevelOrPlayer = mojang.name
            }

            let endMember = await this.getMemberFromContextMenuInteraction(interaction)
            if (!endMember) {
                return interaction.editReply({
                    embeds: [
                        errorEmbed(`That user is not in this server.`)
                    ]
                })
            }
            if (endMember.user.bot) {
                return interaction.editReply({
                    embeds: [
                        errorEmbed(`You cannot use this on bots!`)
                    ]
                })
            }

            const endMongoUser = await this.mongo.getUserByDiscord(endMember.user.id)
            if (!endMongoUser) {
                try {
                    endLevelOrPlayer = endMember.displayName.split(" ")[1].replace(/\W/g, '')
                } catch {
                    return interaction.editReply({
                        embeds: [
                            errorEmbed(`Failed to get username for ${endMember.toString()} from nickname. This user is also not in the database.`)
                        ]
                    })
                }
            } else {
                let mojang = await getMojangFromUuid(endMongoUser.uuid)
                if (mojang === "error" || !mojang) {
                    return interaction.editReply({
                        embeds: [
                            errorEmbed(`Unable to get Mojang data for ${endMember.toString()} from the database or nickname.`)
                        ]
                    })
                }
                endLevelOrPlayer = mojang.name
            }
        }

        let start, end;

        let startUsername, endUsername;

        if (!isNaN(parseFloat(startLevelOrPlayer))) {
            if (parseFloat(startLevelOrPlayer) < 0 || parseFloat(startLevelOrPlayer) > 99) {
                start = startLevelOrPlayer;
            } else {
                start = cataExp(parseFloat(startLevelOrPlayer));
            }
        } else {
            start = startLevelOrPlayer;
        }

        if (!isNaN(parseFloat(endLevelOrPlayer))) {
            if (parseFloat(endLevelOrPlayer) < 0 || parseFloat(endLevelOrPlayer) >= 100) {
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

                for (let i = 0; i < bypassWords.length; i++) {
                    if (start.includes(bypassWords[i])) {
                        start = starWord(start);
                    }
                }

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
                if (className) {
                    start = profile.members[mojang.id].dungeons?.player_classes[className].experience ?? 0
                } else {
                    start = profile.members[mojang.id].dungeons?.dungeon_types.catacombs.experience ?? 0
                }
            }
        }

        if (typeof(end) === "string") {
            const mojang = await getMojang(end);
            if (mojang === "error" || !mojang) {

                for (let i = 0; i < bypassWords.length; i++) {
                    if (end.includes(bypassWords[i])) {
                        end = starWord(end);
                    }
                }

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
                if (className) {
                    end = profile.members[mojang.id].dungeons?.player_classes[className].experience ?? 0
                } else {
                    end = profile.members[mojang.id].dungeons?.dungeon_types.catacombs.experience ?? 0
                }
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
                            value: `**${this.formatter.format(requiredExp)}** ${(className ?? "catacombs")} experience required to go from ${startUsername ? (`${startUsername} (level **${startLevel.toFixed(2)}**)`) : (`level **${startLevel.toFixed(2)}**`)} to ${endUsername ? (`${endUsername} (level **${endLevel.toFixed(2)})**`) : (`level **${endLevel.toFixed(2)}**`)}.`,
                            inline: true
                        }
                    ]
                }
            ]
        })
    }
}