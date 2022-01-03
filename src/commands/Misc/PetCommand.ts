import BaseCommand from "../BaseCommand";
import { DungeonGang } from "../../index";
import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction, MessageAttachment } from "discord.js";
import { Canvas, createCanvas, Image, loadImage } from "canvas";
import GIFEncoder from "gifencoder";
import fs from "fs";
import { ephemeralMessage } from "../../util/Functions";
import * as Buffer from "buffer";
const petGifs: Image[] = []

module.exports = class PetCommand extends BaseCommand {
    constructor(client: DungeonGang) {
        super(client, {
            name: "pet",
            description: "Creates a pet gif.",
            category: "Misc",
            usage: "pet <name>",
            guildOnly: true,
            permLevel: 0,
            slashCommandBody: new SlashCommandBuilder()
                .setName("pet")
                .setDescription("Creates a pet gif.")
                .addUserOption(option => option
                    .setName("user")
                    .setDescription("The user to pet.")
                )
        });
    }

    async init() {
        const petGifUrls = [
            "https://raw.githubusercontent.com/lelboatz/dungeongang/main/data/petImage/pet0.gif",
            "https://raw.githubusercontent.com/lelboatz/dungeongang/main/data/petImage/pet1.gif",
            "https://raw.githubusercontent.com/lelboatz/dungeongang/main/data/petImage/pet2.gif",
            "https://raw.githubusercontent.com/lelboatz/dungeongang/main/data/petImage/pet3.gif",
            "https://raw.githubusercontent.com/lelboatz/dungeongang/main/data/petImage/pet4.gif",
            "https://raw.githubusercontent.com/lelboatz/dungeongang/main/data/petImage/pet5.gif",
            "https://raw.githubusercontent.com/lelboatz/dungeongang/main/data/petImage/pet6.gif",
            "https://raw.githubusercontent.com/lelboatz/dungeongang/main/data/petImage/pet7.gif",
            "https://raw.githubusercontent.com/lelboatz/dungeongang/main/data/petImage/pet8.gif",
            "https://raw.githubusercontent.com/lelboatz/dungeongang/main/data/petImage/pet9.gif"
        ]
        for (let i = 0; i < petGifUrls.length; i++) {
            petGifs.push(await loadImage(petGifUrls[i]))
        }
    }
    async execute(interaction: CommandInteraction) {
        await interaction.deferReply({
            ephemeral: ephemeralMessage(interaction.channelId)
        })
        let user = interaction.options.getUser("user");
        if (!user) {
            user = interaction.user
        }
        const avatarUrl = user.displayAvatarURL({ format: "png", size: 512 });
        const options = { resolution: 192, delay: 20, backgroundColor: null }
        const encoder = new GIFEncoder(options.resolution, options.resolution);
        encoder.start()
        encoder.setRepeat(0)
        encoder.setDelay(options.delay)
        encoder.setTransparent("rgba(255,255,255,0)")

        const petGifCache = []
        const canvas = createCanvas(options.resolution, options.resolution);
        const ctx = canvas.getContext("2d");
        const image = await loadImage(avatarUrl);

        for (let i = 0; i < petGifs.length; i++) {
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            const j = i < 10 / 2 ? i : 10 - i

            const width = 0.8 + j * 0.02
            const height = 0.8 - j * 0.05
            const offsetX = (1 - width) * 0.5 + 0.1
            const offsetY = (1 - height) - 0.08

            ctx.drawImage(image, options.resolution * offsetX, options.resolution * offsetY, options.resolution * width, options.resolution * height)
            ctx.drawImage(petGifs[i], 0, 0, options.resolution, options.resolution)

            encoder.addFrame(ctx)
        }

        encoder.finish()
        let gif = encoder.out.getData()
        return interaction.editReply({
            files: [new MessageAttachment(Buffer.Buffer.from(gif), "pet.gif")]
        })
    }
}