import BaseCommand from "../BaseCommand";
import { DungeonGang } from "../../index";
import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";

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

    }
}