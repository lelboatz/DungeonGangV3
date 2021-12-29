import BaseCommand from "../BaseCommand";
import { DungeonGang } from "../../index";
import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";

module.exports = class UpdateCommand extends BaseCommand {
    constructor(client: DungeonGang) {
        super(client, {
           name: "update",
            category: "Hypixel",
            description: "Updates your cata level.",
            usage: "update <username>",
            guildOnly: true,
            permLevel: 0,
            slashCommandBody: new SlashCommandBuilder()
                .setName("update")
                .setDescription("Updates your cata level.")
                .addStringOption(option => option
                    .setName("username")
                    .setRequired(true)
                    .setDescription("Your minecraft username.")
                )
        });
    }
    async execute(interaction: CommandInteraction) {
        return this.client.commands.get("verify").execute(interaction);
    }
}