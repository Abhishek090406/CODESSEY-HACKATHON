variable "environment" {
  type        = string
  description = "Environment name (dev or test)"
}

variable "resource_group_name" {
  type        = string
  description = "Target resource group provided by organiser"
}

variable "location" {
  type        = string
  description = "Azure region"
  default     = "centralindia"
}

variable "container_app_environment_id" {
  type        = string
  description = "Resource ID of the existing Azure Container App Environment"
}

variable "storage_account_name" {
  type        = string
  description = "Name of existing Azure Storage Account"
}

variable "image_tag" {
  type        = string
  description = "Container image tag to deploy (enables rollback by deploying prior tag)"
  default     = "latest"
}

variable "container_image" {
  type        = string
  description = "Full container image reference without tag or with repository"
  default     = "mcr.microsoft.com/azuredocs/aci-helloworld"
}

variable "app_port" {
  type        = number
  description = "Target port for container app"
  default     = 3000
}
