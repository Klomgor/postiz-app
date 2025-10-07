import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import {
  IntegrationManager,
  socialIntegrationList,
} from '@gitroom/nestjs-libraries/integrations/integration.manager';
import { validationMetadatasToSchemas } from 'class-validator-jsonschema';

@Injectable()
export class IntegrationValidationTool implements AgentToolInterface {
  constructor(private _integrationManager: IntegrationManager) {}
  name = 'integrationSchema';

  async run(): Promise<any> {
    return createTool({
      id: 'integrationSchema',
      description: `Everytime we want to schedule a social media post, we need to understand the schema of the integration.
         This tool helps us get the schema of the integration.
         Sometimes we might get a schema back the requires some id, for that, you can get information from 'tools'
         And use the triggerTool function.
        `,
      inputSchema: z.object({
        isPremium: z
          .boolean()
          .describe('is this the user premium? if not, set to false'),
        platform: z
          .string()
          .describe(
            `platform identifier (${socialIntegrationList
              .map((p) => p.identifier)
              .join(', ')})`
          ),
      }),
      outputSchema: z.object({
        output: z.object({
          maxLength: z
            .number()
            .describe('The maximum length of a post / comment'),
          settings: z
            .any()
            .describe('List of settings need to be passed to schedule a post'),
          tools: z
            .array(
              z.object({
                description: z.string().describe('Description of the tool'),
                methodName: z
                  .string()
                  .describe('Method to call to get the information'),
                dataSchema: z
                  .array(
                    z.object({
                      key: z
                        .string()
                        .describe('Name of the settings key to pass'),
                      description: z
                        .string()
                        .describe('Description of the setting key'),
                      type: z.string(),
                    })
                  )
                  .describe(
                    'This will be passed to schedulePostTool [output:settings]'
                  ),
              })
            )
            .describe(
              "Sometimes settings require some id, tags and stuff, if you don't have, trigger the `triggerTool` function from the tools list [output:callable-tools]"
            ),
        }),
      }),
      execute: async ({ context }) => {
        const integration = socialIntegrationList.find(
          (p) => p.identifier === context.platform
        )!;

        if (!integration) {
          return {
            output: { maxLength: 0, settings: {}, tools: [] },
          };
        }

        const maxLength = integration.maxLength(context.isPremium);
        const schemas = !integration.dto
          ? false
          : validationMetadatasToSchemas()[integration.dto.name];
        const tools = this._integrationManager.getAllTools();

        return {
          output: {
            maxLength,
            settings: !schemas ? 'No additional settings required' : schemas,
            tools: tools[integration.identifier],
          },
        };
      },
    });
  }
}
