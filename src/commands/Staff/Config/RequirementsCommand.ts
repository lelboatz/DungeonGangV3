import BaseCommand from "../../BaseCommand";
import { DungeonGang } from "../../../index";
import { SlashCommandBuilder } from "@discordjs/builders";
import { ApplicationCommandOptionChoice, AutocompleteInteraction, CommandInteraction, MessageEmbed } from "discord.js";
import { embed, ephemeralMessage, errorEmbed } from "../../../util/Functions";

module.exports = class RequirementsCommand extends BaseCommand {
    constructor(client: DungeonGang) {
        super(client, {
            name: "requirements",
            description: "Shows the requirements for Top Player/Misc roles.",
            category: "Staff - Config",
            usage: "requirements <view> <role>/requirements set <role> <requirement>",
            guildOnly: true,
            permLevel: 2,
            slashCommandBody: new SlashCommandBuilder()
                .setName("requirements")
                .setDescription("Shows the requirements for Top Player/Misc roles.")
                .addSubcommand(command => command
                    .setName("view")
                    .setDescription("Shows the requirements for Top Player/Misc roles.")
                    .addStringOption(option => option
                        .setName("role")
                        .setDescription("The role to view the requirements for.")
                        .addChoices([
                            ["✨ Top Player ➕", "topPlus"],
                            ["🌟 Top Player", "topNormal"],
                            ["⭐ Top Player ➖", "topMinus"],
                            ["💨 Speedrunner", "speedrunner"],
                            ["🔎 Secret Duper", "secretDuper"]
                        ])
                        .setRequired(true)
                    )
                )
                .addSubcommand(command => command
                    .setName("set")
                    .setDescription("Sets the requirements for Top Player/Misc roles.")
                    .addStringOption(option => option
                        .setName("role")
                        .setDescription("The role to set the requirements for.")
                        .addChoices([
                            ["✨ Top Player ➕", "topPlus"],
                            ["🌟 Top Player", "topNormal"],
                            ["⭐ Top Player ➖", "topMinus"],
                            ["💨 Speedrunner", "speedrunner"],
                            ["🔎 Secret Duper", "secretDuper"]
                        ])
                        .setRequired(true)
                    )
                    .addStringOption(option => option
                        .setName("requirement")
                        .setDescription("The requirement to set for the role.")
                        .setAutocomplete(true)
                        .setRequired(true)
                    )
                    .addStringOption(option => option
                        .setName("value")
                        .setDescription("The value to set the requirement to.")
                        .setRequired(true)
                    )
                )
        });
    }
    async execute(interaction: CommandInteraction) {
        const subcommand = interaction.options.getSubcommand(true);
        switch (subcommand) {
            case "view": {
                return this.view(interaction);
            }
            case "set": {
                return this.set(interaction);
            }
        }
    }

    async view(interaction: CommandInteraction) {
        await interaction.deferReply({
            ephemeral: ephemeralMessage(interaction.channelId)
        })

        const embed = new MessageEmbed()
            .setTitle("Role Requirements")
            .setColor("#B5FF59")
            .setFooter(this.client.user?.username as string, this.client.user?.avatarURL()?.toString())

        let description = ""

        try {
            // @ts-ignore
            const value = this.client.config.requirements[interaction.options.getString("role")];

            description += `\n<@&${value.role}>`

            for (let [name, requirement] of Object.entries(value)) {
                switch (name) {
                    case "cata": {
                        name = "**Catacombs Level**";
                        if (!requirement) requirement = "None";
                        break;
                    }
                    case "secrets": {
                        name = "**Secrets**";
                        if (!requirement) requirement = "None";
                        break;
                    }
                    case "bloodMobs": {
                        name = "**Blood Mobs**";
                        if (!requirement) requirement = "None";
                        break;
                    }
                    case "floorSeven": {
                        name = "**Floor 7 S+ PB**";
                        (requirement ? requirement += " seconds" : requirement = "None");
                        break;
                    }
                    case "masterFive": {
                        name = "**Master 5 S+ PB**";
                        (requirement ? requirement += " seconds" : requirement = "None");
                        break;
                    }
                    case "masterSix": {
                        name = "**Master 6 S+ PB**";
                        (requirement ? requirement += " seconds" : requirement = "None");
                        break;
                    }
                    case "masterSeven": {
                        name = "**Master 7 S+ PB**";
                        (requirement ? requirement += " seconds" : requirement = "None");
                        break;
                    }
                    case "role": {
                        name = "**Role ID**"
                        break;
                    }
                }
                description += `\n\t${name}: ${requirement}`
            }
            description += "\n\nNote: Players only need to meet **one** of the blood mob/secret requirements and **one** of the pb requirements to get the role."
            embed.setDescription(description)

            return interaction.editReply({
                embeds: [embed]
            })
        } catch (error) {
            console.error(error)
            return interaction.editReply({
                embeds: [
                    errorEmbed("There was an error fetching the role requirements.")
                ]
            })
        }

    }

    async set(interaction: CommandInteraction) {
        await interaction.deferReply({
            ephemeral: ephemeralMessage(interaction.channelId)
        })

        const role = interaction.options.getString("role", true);
        const requirement = interaction.options.getString("requirement", true);
        let value: string | number = interaction.options.getString("value", true);
        const config = this.client.config;
        let prettyRequirement = requirement;
        let prettyRole = role;

        switch (requirement) {
            case "cata": {
                prettyRequirement = "Catacombs Level";
                break;
            }
            case "secrets": {
                prettyRequirement = "Secrets";
                break;
            }
            case "bloodMobs": {
                prettyRequirement = "Blood Mobs";
                break;
            }
            case "floorSeven": {
                prettyRequirement = "Floor 7 S+ PB";
                break;
            }
            case "masterFive": {
                prettyRequirement = "Master 5 S+ PB";
                break;
            }
            case "masterSix": {
                prettyRequirement = "Master 6 S+ PB";
                break;
            }
            case "masterSeven": {
                prettyRequirement = "Master 7 S+ PB";
                break;
            }
            case "role": {
                prettyRequirement = "Role ID";
                break;
            }
        }

        switch (role) {
            case "topPlus": {
                prettyRole = "✨ Top Player ➕"
                break;
            }
            case "topNormal": {
                prettyRole = "🌟 Top Player"
                break;
            }
            case "topMinus": {
                prettyRole = "⭐ Top Player ➖"
                break;
            }
            case "speedrunner": {
                prettyRole = "💨 Speedrunner"
                break;
            }
            case "secretDuper": {
                prettyRole = "🔎 Secret Duper"
                break;
            }
        }

        // @ts-ignore
        if (config.requirements[role][requirement] === undefined) {
            return interaction.editReply({
                embeds: [
                    errorEmbed(`The requirement \`${prettyRequirement}\` does not exist.`)
                ]
            })
        }

        value = value.toLowerCase();

        if (value === "none") {
            // @ts-ignore
            config.requirements[role][requirement] = null;
            this.client.config = config;
            return interaction.editReply({
                embeds: [
                    embed("Success", `Removed the requirement \`${prettyRequirement}\` from the role \`${prettyRole}\`.`)
                ]
            })
        }

        value = parseInt(value);

        if (isNaN(value)) {
            return interaction.editReply({
                embeds: [
                    errorEmbed(`The value \`${interaction.options.getString("value", true)}\` is not a valid number.`)
                ]
            })
        }

        // @ts-ignore
        config.requirements[role][requirement] = value;
        this.client.config = config;
        return interaction.editReply({
            embeds: [
                embed("Success", `Set the requirement \`${prettyRequirement}\` to \`${value}\` for the role \`${prettyRole}\`.`)
            ]
        })
    }

    async autocomplete(interaction: AutocompleteInteraction) {
        if (interaction.options.getFocused(true).name === "requirement") {
            const response: ApplicationCommandOptionChoice[] = []
            const role = interaction.options.get("role");
            if (!role?.value) {
                return interaction.respond([])
            }

            try {
                // @ts-ignore
                for (let [key] of Object.entries(this.client.config.requirements[role.value])) {
                    switch (key) {
                        case "cata": {
                            response.push({
                                name: "Catacombs Level",
                                value: key
                            })
                            break;
                        }
                        case "secrets": {
                            response.push({
                                name: "Secrets",
                                value: key
                            })
                            break;
                        }
                        case "bloodMobs": {
                            response.push({
                                name: "Blood Mobs",
                                value: key
                            })
                            break;
                        }
                        case "floorSeven": {
                            response.push({
                                name: "Floor 7 S+ PB",
                                value: key
                            })
                            break;
                        }
                        case "masterFive": {
                            response.push({
                                name: "Master 5 S+ PB",
                                value: key
                            })
                            break;
                        }
                        case "masterSix": {
                            response.push({
                                name: "Master 6 S+ PB",
                                value: key
                            })
                            break;
                        }
                        case "masterSeven": {
                            response.push({
                                name: "Master 7 S+ PB",
                                value: key
                            })
                            break;
                        }
                        case "role": {
                            response.push({
                                name: "Role ID",
                                value: key
                            })
                            break;
                        }
                    }
                }
                return interaction.respond(response);
            } catch {
                return interaction.respond([])
            }
        }
    }

}