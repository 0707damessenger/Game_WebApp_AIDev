class AIChat {
  constructor(config) {
    this.config = config;
    this.apiEndpoint = config.ai.endpoint || '';
    this.apiKey = config.ai.apiKey || '';
    this.model = config.ai.model || 'gpt-3.5-turbo';
    this.systemPrompt = config.ai.systemPrompt || '你是一个可爱的桌面宠物，说话俏皮活泼。';
    this.messages = [];
    this.isProcessing = false;
  }

  setEndpoint(url) {
    this.apiEndpoint = url;
  }

  setApiKey(key) {
    this.apiKey = key;
  }

  setModel(model) {
    this.model = model;
  }

  setSystemPrompt(prompt) {
    this.systemPrompt = prompt;
  }

  async sendMessage(userMessage) {
    if (!this.apiEndpoint) {
      return { error: '请先配置API端点' };
    }
    
    if (!this.apiKey) {
      return { error: '请先配置API Key' };
    }
    
    if (this.isProcessing) {
      return { error: '正在思考中...' };
    }

    this.isProcessing = true;
    this.messages.push({ role: 'user', content: userMessage });

    const body = {
      model: this.model,
      messages: [
        { role: 'system', content: this.systemPrompt },
        ...this.messages.slice(-10)
      ],
      max_tokens: 200,
      temperature: 0.8
    };

    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + this.apiKey
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.isProcessing = false;
        return { error: 'API错误: ' + response.status + ' ' + errorText.substring(0, 100) };
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      this.messages.push({ role: 'assistant', content: content });
      this.isProcessing = false;
      
      return { content: content };
    } catch (error) {
      this.isProcessing = false;
      return { error: '网络错误: ' + error.message };
    }
  }

  getConfig() {
    return {
      endpoint: this.apiEndpoint,
      apiKey: this.apiKey ? this.apiKey.substring(0, 8) + '...' : '',
      model: this.model,
      systemPrompt: this.systemPrompt
    };
  }
}