package domain

import "context"

type ConfigDefinition struct {
	Key         string  `json:"key"`
	Scope       string  `json:"scope"`
	Type        string  `json:"type"`
	Description *string `json:"description"`
	DefaultVal  *string `json:"default_val"`
}

type CreateConfigDefinitionInput struct {
	Key         string  `json:"key"`
	Scope       string  `json:"scope"`
	Type        string  `json:"type"`
	Description *string `json:"description,omitempty"`
	DefaultVal  *string `json:"default_val,omitempty"`
}

type UpdateConfigDefinitionInput struct {
	Type        *string `json:"type,omitempty"`
	Description *string `json:"description,omitempty"`
	DefaultVal  *string `json:"default_val,omitempty"`
}

type ConfigDefinitionRepository interface {
	List(ctx context.Context) ([]*ConfigDefinition, error)
	Get(ctx context.Context, scope string, key string) (*ConfigDefinition, error)
	Create(ctx context.Context, input CreateConfigDefinitionInput) (*ConfigDefinition, error)
	Update(ctx context.Context, scope string, key string, input UpdateConfigDefinitionInput) (*ConfigDefinition, error)
	Delete(ctx context.Context, scope string, key string) error
}
