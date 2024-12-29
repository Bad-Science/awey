module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce Actor subclass public methods to start with underscore',
      category: 'Best Practices',
    },
    messages: {
      noPublicMethods: 'Public methods in Actor subclasses must start with underscore: {{ methodName }}',
    },
  },

  create(context) {
    return {
      ClassDeclaration(node) {
        // Check if class extends Actor
        if (node.superClass && node.superClass.name === 'Actor') {
          // Look through class methods
          node.body.body.forEach(member => {
            if (
              member.type === 'MethodDefinition' && 
              member.key.type === 'Identifier' &&
              !member.static &&
              member.accessibility !== 'private' &&
              member.accessibility !== 'protected' &&
              !member.key.name.startsWith('_')
            ) {
              context.report({
                node: member,
                messageId: 'noPublicMethods',
                data: {
                  methodName: member.key.name,
                },
              });
            }
          });
        }
      }
    };
  }
}; 