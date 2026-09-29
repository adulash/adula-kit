export default {
  rules: {
    'no-cross-module-controller': {
      meta: {
        type: 'problem',
        schema: [],
        messages: {
          forbidden: 'Modules communicate through events, not cross-module controller imports.',
        },
      },
      create(context) {
        return {
          ImportDeclaration(node) {
            const owner = context.filename
              .replaceAll('\\', '/')
              .match(/app\/modules\/([^/]+)\//)?.[1]
            const target = String(node.source.value).match(
              /(?:#modules\/|modules\/)([^/]+)\/controllers\//
            )?.[1]
            if (owner && target && owner !== target)
              context.report({ node, messageId: 'forbidden' })
          },
        }
      },
    },
    'no-direct-to-json': {
      meta: {
        type: 'problem',
        schema: [],
        messages: { forbidden: 'Use the kit serialize contract rather than toJSON().' },
      },
      create(context) {
        return {
          CallExpression(node) {
            if (
              node.callee.type === 'MemberExpression' &&
              node.callee.property.type === 'Identifier' &&
              node.callee.property.name === 'toJSON'
            )
              context.report({ node, messageId: 'forbidden' })
          },
        }
      },
    },
    'no-system-save-in-controllers': {
      meta: {
        type: 'problem',
        schema: [],
        messages: {
          forbidden:
            'systemSave and rehome skip role rules. Call them from listeners or module services after an explicit authorization, never from a controller or route.',
        },
      },
      create(context) {
        const file = context.filename.replaceAll('\\', '/')
        // Request handlers act for a user, so their writes go through save() and its rules.
        if (!/(?:^|\/)(?:app\/controllers|app\/modules\/[^/]+\/controllers)\/|(?:^|\/)start\/routes\./.test(file))
          return {}
        return {
          CallExpression(node) {
            if (
              node.callee.type === 'MemberExpression' &&
              node.callee.property.type === 'Identifier' &&
              ['systemSave', 'rehome'].includes(node.callee.property.name)
            )
              context.report({ node, messageId: 'forbidden' })
          },
        }
      },
    },
    'no-kit-patching': {
      meta: {
        type: 'problem',
        schema: [],
        messages: { forbidden: 'Do not patch installed @adula packages or use patch-package.' },
      },
      create(context) {
        return {
          Literal(node) {
            if (
              typeof node.value === 'string' &&
              /patch-package|node_modules[/\\]@adula/.test(node.value)
            )
              context.report({ node, messageId: 'forbidden' })
          },
        }
      },
    },
  },
}
