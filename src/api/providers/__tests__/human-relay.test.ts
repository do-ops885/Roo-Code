import { HumanRelayHandler } from "../human-relay"
import { humanRelayModelId, humanRelayModels } from "../../../shared/api"
import * as vscode from "vscode"

jest.mock("vscode", () => ({
	env: {
		clipboard: {
			writeText: jest.fn(),
		},
	},
	commands: {
		executeCommand: jest.fn(),
	},
}))

describe("HumanRelayHandler", () => {
	let registeredCallback: ((response: string | undefined) => void) | undefined
	let simulatedResponse: string | undefined = undefined

	beforeEach(() => {
		jest.resetModules()
		registeredCallback = undefined
		simulatedResponse = undefined // Reset simulated response for each test
		jest.spyOn(vscode.commands, "executeCommand").mockImplementation(async (command: string, ...args: any[]) => {
			if (command === "roo-cline.registerHumanRelayCallback") {
				registeredCallback = args[1]
			} else if (command === "roo-cline.showHumanRelayDialog") {
				// Simulate the dialog showing and the user responding almost immediately
				// The actual response will be set per-test if needed
				if (registeredCallback) {
					// Use a small delay to ensure promise chains are set up
					await new Promise((resolve) => setTimeout(resolve, 0))
					registeredCallback(simulatedResponse)
				}
			}
			return Promise.resolve()
		})
	})

	it("should return the correct model information", () => {
		// Arrange
		const handler = new HumanRelayHandler({} as any) // Mock options

		// Act
		const model = handler.getModel()

		// Assert
		expect(model.id).toBe(humanRelayModelId)
		expect(model.info).toEqual(humanRelayModels[humanRelayModelId])
	})

	it("should throw an error if no message is provided in createMessage", async () => {
		const handler = new HumanRelayHandler({} as any)
		await expect(async () => {
			for await (const _ of handler.createMessage("System prompt", [])) {
				// consume the stream
			}
		}).rejects.toThrow("No message to relay")
	})

	it("should copy the prompt to the clipboard in createMessage", async () => {
		const handler = new HumanRelayHandler({} as any)
		const messages = [{ content: "User message", role: "user" as const }]
		simulatedResponse = "User response" // Set the response for this test

		const stream = handler.createMessage("System prompt", messages)

		for await (const chunk of stream) {
			expect(chunk).toEqual({ type: "text", text: "User response" })
		}

		expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith("System prompt\n\nUser message")
	}, 20000)

	it("should throw an error if the user cancels the operation in createMessage", async () => {
		const handler = new HumanRelayHandler({} as any)
		const messages = [{ content: "User message", role: "user" as const }]
		simulatedResponse = undefined // Simulate cancellation

		const stream = handler.createMessage("System prompt", messages)

		await expect(async () => {
			for await (const _ of stream) {
				// consume the stream
			}
		}).rejects.toThrow("Human relay operation cancelled")
	}, 20000)

	it("should return the user's response in createMessage", async () => {
		const handler = new HumanRelayHandler({} as any)
		const messages = [{ content: "User message", role: "user" as const }]
		simulatedResponse = "User response" // Set the response for this test

		const stream = handler.createMessage("System prompt", messages)

		for await (const chunk of stream) {
			expect(chunk).toEqual({ type: "text", text: "User response" })
		}
	}, 20000)

	it("should copy the prompt to the clipboard in completePrompt", async () => {
		const handler = new HumanRelayHandler({} as any)
		const prompt = "Prompt to complete"
		simulatedResponse = "User response" // Set the response for this test

		const promise = handler.completePrompt(prompt)
		const result = await promise
		expect(result).toBe("User response")
		expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith(prompt)
	}, 20000)
})
